// Background service worker for postMessage DevTools

// Store connected devtools ports by tab ID
const connections = {};

// Store message history by tab ID - use an object that will persist across service worker restarts
let messageHistory = {};

// Flag to track if service worker is active
let isActive = true;

// Persistent alarm name
const KEEP_ALIVE_ALARM = 'postMessageDevToolsKeepAlive';

// Load any saved message history from storage when the service worker starts
function initializeState() {
  chrome.storage.local.get(['postMessageHistory'], function(result) {
    if (result.postMessageHistory) {
      messageHistory = result.postMessageHistory;
      console.log('Loaded message history from storage');
    }
  });
  
  // Ensure our keep-alive alarm is set
  ensureKeepAliveAlarm();
}

// Ensure the keep-alive alarm is set
function ensureKeepAliveAlarm() {
  chrome.alarms.get(KEEP_ALIVE_ALARM, (alarm) => {
    if (!alarm) {
      console.log('Setting up keep-alive alarm');
      chrome.alarms.create(KEEP_ALIVE_ALARM, { 
        periodInMinutes: 0.25  // Every 15 seconds (minimum allowed by Chrome)
      });
    }
  });
}

// Initialize state when extension is installed or updated
chrome.runtime.onInstalled.addListener(initializeState);

// Also initialize state when the service worker starts
initializeState();

// Save message history to storage periodically and on demand
function saveMessageHistory() {
  if (isActive) {
    chrome.storage.local.set({ postMessageHistory: messageHistory }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving message history:', chrome.runtime.lastError);
      }
    });
  }
}

// Setup regular saving of message history
const AUTO_SAVE_INTERVAL = 5000; // 5 seconds
setInterval(() => {
  if (isActive) {
    saveMessageHistory();
  }
}, AUTO_SAVE_INTERVAL);

// Ping all connected devtools panels to keep connections alive
function pingConnections() {
  Object.keys(connections).forEach(tabId => {
    try {
      const port = connections[tabId];
      port.postMessage({ type: 'PING' });
    } catch (e) {
      console.error(`Error pinging panel for tab ${tabId}:`, e);
      // Connection might be broken, remove it
      delete connections[tabId];
    }
  });
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
      } else if (message.type === 'PANEL_PING') {
        // Panel is pinging us to keep connection alive, respond with pong
        port.postMessage({ type: 'PANEL_PONG' });
      }
    });
    
    // Remove the connection when the devtools panel is closed
    port.onDisconnect.addListener(function() {
      delete connections[tabId];
      console.log(`DevTools panel disconnected for tab ${tabId}`);
    });
  }
});

// Process a single message and add to history
function processMessage(message, tabId) {
  // Initialize message history for this tab if it doesn't exist
  if (!messageHistory[tabId]) {
    messageHistory[tabId] = [];
  }
  
  // Add the message to history
  messageHistory[tabId].push({
    ...message,
    tabId
  });
  
  // Limit history size to prevent excessive storage use
  if (messageHistory[tabId].length > 1000) {
    messageHistory[tabId] = messageHistory[tabId].slice(-1000);
  }
  
  // Forward the message to the devtools panel if it's open
  if (connections[tabId]) {
    try {
      connections[tabId].postMessage({
        type: 'NEW_MESSAGE',
        message: message
      });
    } catch (e) {
      console.error(`Error forwarding message to panel for tab ${tabId}:`, e);
      // Connection might be broken, remove it
      delete connections[tabId];
    }
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // Immediately respond to keep connections alive (helps prevent context invalidation)
  try {
    sendResponse({success: true});
  } catch (e) {
    console.error('Error sending response:', e);
  }
  
  // Handle reconnection requests from content scripts
  if (message.type === 'CONTENT_SCRIPT_CONNECTED') {
    if (!sender.tab) return;
    console.log(`Content script connected for tab ${sender.tab.id}`, message.url);
    // Initialize message history for this tab if it doesn't exist
    if (!messageHistory[sender.tab.id]) {
      messageHistory[sender.tab.id] = [];
    }
  }
  
  // Process postMessage events from content script
  else if (message.type === 'POSTMESSAGE_EVENT' && sender.tab) {
    const tabId = sender.tab.id.toString();
    processMessage(message.message, tabId);
  }
  
  // Handle batched messages from content script
  else if (message.type === 'BATCH_POSTMESSAGE_EVENTS' && sender.tab) {
    const tabId = sender.tab.id.toString();
    if (Array.isArray(message.messages)) {
      message.messages.forEach(msg => {
        processMessage(msg, tabId);
      });
    }
  }
  
  // Return false since we already called sendResponse
  return false;
});

// Keep the service worker alive by handling periodic wake-up
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    // Renew the keep-alive alarm (in case it gets removed)
    ensureKeepAliveAlarm();
    
    // Ping all connected panels to keep connections alive
    pingConnections();
    
    // Check if we need to trim message history for inactive tabs
    const now = Date.now();
    let needsSave = false;
    
    Object.keys(messageHistory).forEach(tabId => {
      // If tab hasn't received messages in over an hour, trim history
      if (messageHistory[tabId].length > 0) {
        const lastMessage = messageHistory[tabId][messageHistory[tabId].length - 1];
        if (lastMessage && (now - lastMessage.timestamp) > 3600000) {
          messageHistory[tabId] = [];
          needsSave = true;
        }
      }
    });
    
    if (needsSave) {
      saveMessageHistory();
    }
  }
});

// Handle service worker lifecycle events
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  // Force activation without waiting for existing service worker to terminate
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  isActive = true;
  // Claim any existing clients
  event.waitUntil(clients.claim());
});

// Save state before service worker is terminated
self.addEventListener('beforeunload', () => {
  isActive = false;
  console.log('Service worker terminating, saving state...');
  saveMessageHistory();
});

// Handle message events directly (alternative connection method)
self.addEventListener('message', (event) => {
  console.log('Service worker received direct message:', event.data);
}); 