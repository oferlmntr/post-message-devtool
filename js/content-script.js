// Content script to capture postMessage events

// Create a unique ID for this tab
const tabId = Math.random().toString(36).substring(2, 15);

// Override the native postMessage method to capture events
const originalPostMessage = window.postMessage;
const originalAddEventListener = window.addEventListener;

// Track event listeners for postMessage
const messageListeners = new Set();

// Local message queue for when background is unavailable
const messageQueue = [];
let isBackgroundAvailable = true;
let reconnectTimer = null;

// Flag to track if page is unloading
let isUnloading = false;

// Add page unload listener
window.addEventListener('beforeunload', () => {
  isUnloading = true;
});

// Override addEventListener to track postMessage listeners
window.addEventListener = function(type, listener, options) {
  if (type === 'message') {
    messageListeners.add(listener);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

// Function to safely send messages to the background script
function safeSendMessage(message) {
  // If page is unloading, don't try to send messages
  if (isUnloading) return;
  
  // If we know background is unavailable, queue message instead of trying to send
  if (!isBackgroundAvailable) {
    if (message.type === 'POSTMESSAGE_EVENT') {
      messageQueue.push(message);
      // Limit queue size to prevent memory issues
      if (messageQueue.length > 1000) {
        messageQueue.shift();
      }
    }
    return;
  }

  try {
    // Wrap in a try-catch to catch any immediate errors
    const sendPromise = new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, response => {
          const error = chrome.runtime.lastError;
          if (error) {
            // Check specifically for context invalidation
            if (error.message && (
                error.message.includes('Extension context invalidated') || 
                error.message.includes('disconnected port') ||
                error.message.includes('Could not establish connection')
            )) {
              console.log('Extension context invalidated, queuing messages');
              handleBackgroundDisconnection();
            } else {
              console.log('Background error:', error.message);
            }
          }
          resolve();
        });
      } catch (e) {
        // Immediate error during send
        console.log('Error during sendMessage:', e);
        handleBackgroundDisconnection();
        resolve();
      }
    });
    
    // Add a timeout to prevent hanging if chrome.runtime is in a bad state
    setTimeout(() => {
      handleBackgroundDisconnection();
    }, 1000);
  } catch (e) {
    console.log('Error in safeSendMessage outer block:', e);
    handleBackgroundDisconnection();
  }
}

// Handle background disconnection
function handleBackgroundDisconnection() {
  isBackgroundAvailable = false;
  
  // Clear any existing reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  // Set up reconnection with exponential backoff
  reconnectTimer = setTimeout(attemptReconnection, 2000);
}

// Test if extension context is valid
function isExtensionContextValid() {
  try {
    // Try accessing a chrome API that doesn't require permissions
    // This will throw if the context is invalid
    chrome.runtime.getURL('');
    return true;
  } catch (e) {
    return false;
  }
}

// Attempt to reconnect to background
function attemptReconnection() {
  // First check if extension context is valid at all
  if (!isExtensionContextValid()) {
    console.log('Extension context still invalid, will retry later');
    const nextInterval = Math.min(60000, (reconnectTimer ? reconnectTimer * 2 : 2000));
    reconnectTimer = setTimeout(attemptReconnection, nextInterval);
    return;
  }

  try {
    const connectPromise = new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ 
          type: 'CONTENT_SCRIPT_CONNECTED', 
          tabId,
          url: window.location.href
        }, response => {
          const error = chrome.runtime.lastError;
          if (error) {
            console.log('Reconnection failed:', error.message);
            // Still unavailable, retry with exponential backoff (max 1 minute interval)
            const nextInterval = Math.min(60000, (reconnectTimer ? reconnectTimer * 2 : 2000));
            reconnectTimer = setTimeout(attemptReconnection, nextInterval);
          } else {
            // Successfully reconnected
            console.log('Successfully reconnected to background');
            isBackgroundAvailable = true;
            reconnectTimer = null;
            flushMessageQueue();
          }
          resolve();
        });
      } catch (e) {
        console.log('Error during reconnection attempt:', e);
        // Still unavailable, retry with backoff
        const nextInterval = Math.min(60000, (reconnectTimer ? reconnectTimer * 2 : 2000));
        reconnectTimer = setTimeout(attemptReconnection, nextInterval);
        resolve();
      }
    });
    
    // Add timeout for reconnection attempt
    setTimeout(() => {
      if (!isBackgroundAvailable) {
        console.log('Reconnection attempt timed out');
        const nextInterval = Math.min(60000, (reconnectTimer ? reconnectTimer * 2 : 2000));
        reconnectTimer = setTimeout(attemptReconnection, nextInterval);
      }
    }, 2000);
  } catch (e) {
    console.log('Error in attemptReconnection outer block:', e);
    // Still unavailable, retry with backoff
    const nextInterval = Math.min(60000, (reconnectTimer ? reconnectTimer * 2 : 2000));
    reconnectTimer = setTimeout(attemptReconnection, nextInterval);
  }
}

// Flush the message queue once reconnected
function flushMessageQueue() {
  if (messageQueue.length > 0) {
    console.log(`Sending ${messageQueue.length} queued messages`);
    
    // Send messages in batches to avoid overwhelming
    const BATCH_SIZE = 50;
    while (messageQueue.length > 0) {
      const batch = messageQueue.splice(0, Math.min(BATCH_SIZE, messageQueue.length));
      safeSendMessage({
        type: 'BATCH_POSTMESSAGE_EVENTS',
        messages: batch.map(item => item.message)
      });
    }
  }
}

// Listen for all postMessage events
window.addEventListener('message', function(event) {
  // Avoid capturing internal extension messages
  if (event.source === window && 
      typeof event.data === 'object' && 
      event.data.type && 
      typeof event.data.type === 'string' && 
      event.data.type.startsWith('POSTMESSAGE_DEVTOOLS_')) {
    return;
  }

  // Create a message object
  const message = {
    source: window.location.href,
    origin: event.origin,
    timestamp: Date.now(),
    data: event.data
  };

  // Send the captured message to the background script
  safeSendMessage({
    type: 'POSTMESSAGE_EVENT',
    message
  });
}, true);

// Inform the background script that this content script is ready
// Wrap in setTimeout to ensure the DOM is fully loaded
setTimeout(() => {
  safeSendMessage({ 
    type: 'CONTENT_SCRIPT_CONNECTED', 
    tabId,
    url: window.location.href
  });
}, 0);

// Set up a heartbeat to check background availability periodically
setInterval(() => {
  if (!isBackgroundAvailable && !isUnloading) {
    attemptReconnection();
  }
}, 30000); // Check every 30 seconds 