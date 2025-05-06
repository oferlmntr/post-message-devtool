// Background service worker for postMessage DevTools

// Store connected devtools ports by tab ID
const connections = {};

// Store message history by tab ID - use an object that will persist across service worker restarts
let messageHistory = {};

// Load any saved message history from storage
chrome.storage.local.get(['postMessageHistory'], function(result) {
  if (result.postMessageHistory) {
    messageHistory = result.postMessageHistory;
  }
});

// Save message history to storage periodically
function saveMessageHistory() {
  chrome.storage.local.set({ postMessageHistory: messageHistory });
}

// Listen for connections from the devtools panel
chrome.runtime.onConnect.addListener(function(port) {
  // Check that the connection is from our devtools panel
  if (port.name.startsWith('postMessageDevTools-')) {
    const tabId = port.name.split('-')[1];
    
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
      }
    });
    
    // Remove the connection when the devtools panel is closed
    port.onDisconnect.addListener(function() {
      delete connections[tabId];
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // Process postMessage events from content script
  if (message.type === 'POSTMESSAGE_EVENT' && sender.tab) {
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
  }
  
  // Return true to indicate we might respond asynchronously
  return true;
});

// Keep the service worker alive by handling periodic wake-up
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
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