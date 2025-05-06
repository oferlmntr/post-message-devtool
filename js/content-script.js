// Content script to capture postMessage events

// Create a unique ID for this tab
const tabId = Math.random().toString(36).substring(2, 15);

// Override the native postMessage method to capture events
const originalPostMessage = window.postMessage;
const originalAddEventListener = window.addEventListener;

// Track event listeners for postMessage
const messageListeners = new Set();

// Override addEventListener to track postMessage listeners
window.addEventListener = function(type, listener, options) {
  if (type === 'message') {
    messageListeners.add(listener);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

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
  chrome.runtime.sendMessage({
    type: 'POSTMESSAGE_EVENT',
    message
  });
}, true);

// Inform the background script that this content script is ready
chrome.runtime.sendMessage({ 
  type: 'CONTENT_SCRIPT_CONNECTED', 
  tabId,
  url: window.location.href
}); 