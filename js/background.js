// Background service worker for postMessage DevTools

// Store connected devtools ports by tab ID
const connections = {};

// Store message history by tab ID - use an object that will persist across service worker restarts
let messageHistory = {};

// Load any saved message history from storage when the service worker starts
function initializeState() {
  chrome.storage.local.get(['postMessageHistory'], function(result) {
    if (result.postMessageHistory) {
      messageHistory = result.postMessageHistory;
      console.log('Loaded message history from storage');
    }
  });
}

// Initialize state when extension is installed or updated
chrome.runtime.onInstalled.addListener(initializeState);

// Also initialize state when the service worker starts
initializeState();

// Save message history to storage periodically
function saveMessageHistory() {
  chrome.storage.local.set({ postMessageHistory: messageHistory });
}

// Listen for connections from the devtools panel
chrome.runtime.onConnect.addListener(function(port) {
  // Check that the connection is from our devtools panel
  if (port.name.startsWith('postMessageDevTools-')) {
    const tabId = port.name.split('-')[1];
    
    console.log(`DevTools panel connected for tab ${tabId}`);
    
    // Store the connection
    connections[tabId] = port;
    
    // Initialize message history for this tab if it doesn't exist
    if (!messageHistory[tabId]) {
      messageHistory[tabId] = [];
    }
    
    // Send existing message history to panel when it connects
    port.postMessage({
      type: 'HISTORY_UPDATED',
      messages: messageHistory[tabId]
    });

    // Handle messages from the devtools panel
    port.onMessage.addListener(function(message) {
      if (message.type === 'CLEAR_HISTORY') {
        // Clear history for this tab
        messageHistory[tabId] = [];
        saveMessageHistory();
        
        // Notify the panel that history was cleared
        port.postMessage({
          type: 'HISTORY_UPDATED',
          messages: []
        });
      } else if (message.type === 'REQUEST_HISTORY') {
        // Send the current history to the panel (used for reconnection)
        port.postMessage({
          type: 'HISTORY_UPDATED',
          messages: messageHistory[tabId] || []
        });
      }
    });
    
    // Remove the connection when the devtools panel is closed
    port.onDisconnect.addListener(function() {
      delete connections[tabId];
      console.log(`DevTools panel disconnected for tab ${tabId}`);
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // Handle reconnection requests from content scripts
  if (message.type === 'CONTENT_SCRIPT_CONNECTED') {
    console.log(`Content script connected for tab ${sender.tab.id}`, message.url);
    // Initialize message history for this tab if it doesn't exist
    if (!messageHistory[sender.tab.id]) {
      messageHistory[sender.tab.id] = [];
    }
    // Send acknowledgment
    sendResponse({success: true});
  }
  
  // Process postMessage events from content script
  else if (message.type === 'POSTMESSAGE_EVENT' && sender.tab) {
    const tabId = sender.tab.id.toString();
    
    // Initialize message history for this tab if it doesn't exist
    if (!messageHistory[tabId]) {
      messageHistory[tabId] = [];
    }
    
    // Add the message to history
    messageHistory[tabId].push({
      ...message.message,
      tabId
    });
    
    // Limit history size to prevent excessive storage use
    if (messageHistory[tabId].length > 1000) {
      messageHistory[tabId] = messageHistory[tabId].slice(-1000);
    }
    
    // Save updated history
    saveMessageHistory();
    
    // Forward the message to the devtools panel if it's open
    if (connections[tabId]) {
      connections[tabId].postMessage({
        type: 'NEW_MESSAGE',
        message: message.message
      });
    }
    
    // Send acknowledgment
    sendResponse({success: true});
  }
  
  // Return true to indicate we might respond asynchronously
  return true;
});

// Keep the service worker alive by handling periodic wake-up
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('Service worker keep-alive ping');
    
    // Check if we need to trim message history for inactive tabs
    const now = Date.now();
    let needsSave = false;
    
    Object.keys(messageHistory).forEach(tabId => {
      // If tab hasn't received messages in over an hour, trim history
      const lastMessage = messageHistory[tabId][messageHistory[tabId].length - 1];
      if (lastMessage && (now - lastMessage.timestamp) > 3600000) {
        messageHistory[tabId] = [];
        needsSave = true;
      }
    });
    
    if (needsSave) {
      saveMessageHistory();
    }
  }
}); 