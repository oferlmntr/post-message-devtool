// Panel script for postMessage DevTools

// DOM Elements
const messagesContainer = document.getElementById('messages');
const emptyState = document.getElementById('empty-state');
const clearButton = document.getElementById('clear-btn');
const pauseButton = document.getElementById('pause-btn');
const preserveLogCheckbox = document.getElementById('preserve-log');
const filterButton = document.getElementById('filter-btn');
const filterContainer = document.getElementById('filter-container');
const originFilterInput = document.getElementById('origin-filter');
const contentFilterInput = document.getElementById('content-filter');
const applyFilterButton = document.getElementById('apply-filter');
const resetFilterButton = document.getElementById('reset-filter');
const connectionIndicator = document.getElementById('connection-indicator');

// Connect to the background script
const tabId = chrome.devtools.inspectedWindow.tabId;
let port;
let reconnectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 20; // Increased max attempts
let isConnected = false;
let reconnectTimer = null;
let pingTimer = null;
let pingTimeoutTimer = null;
let lastPongTime = 0;
let isPaused = false; // Track whether log tracking is paused

// Initialize connection indicator
if (connectionIndicator) {
  connectionIndicator.classList.add('disconnected');
}

// Function to establish connection with the background script
function connectToBackground() {
  // Update connection indicator immediately to show we're trying to connect
  if (connectionIndicator) {
    connectionIndicator.classList.add('disconnected');
  }
  
  try {
    // Create a new port connection
    port = chrome.runtime.connect({
      name: `postMessageDevTools-${tabId}`
    });
    
    console.log('Connected to background script');
    
    // Reset reconnection attempts on successful connection
    reconnectionAttempts = 0;
    isConnected = true;
    lastPongTime = Date.now();
    
    // Start the heartbeat ping
    startHeartbeat();
    
    // Handle messages from background script
    port.onMessage.addListener(handleBackgroundMessage);
    
    // Handle disconnection
    port.onDisconnect.addListener(() => {
      isConnected = false;
      console.log('Disconnected from background script');
      
      // Show a non-intrusive reconnection message
      showReconnectionStatus(true);
      
      // Stop the heartbeat
      stopHeartbeat();
      
      // Check for error
      if (chrome.runtime.lastError) {
        console.error('Connection error:', chrome.runtime.lastError.message);
      }
      
      // Attempt to reconnect with exponential backoff
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      
      const backoffDelay = Math.min(60000, 1000 * Math.pow(2, reconnectionAttempts));
      reconnectionAttempts++;
      
      console.log(`Reconnection attempt ${reconnectionAttempts} scheduled in ${backoffDelay}ms`);
      reconnectTimer = setTimeout(connectToBackground, backoffDelay);
    });
    
    // Request message history after connection
    requestMessageHistory();
    
    // Hide the reconnection message if shown
    showReconnectionStatus(false);
    
    // Update connection indicator to show successful connection
    if (connectionIndicator) {
      connectionIndicator.classList.remove('disconnected');
    }
  } catch (error) {
    console.error('Error connecting to background script:', error);
    isConnected = false;
    
    // Stop the heartbeat if it was running
    stopHeartbeat();
    
    // Show the reconnection message
    showReconnectionStatus(true);
    
    // Try to reconnect with exponential backoff
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    const backoffDelay = Math.min(60000, 1000 * Math.pow(2, reconnectionAttempts));
    reconnectionAttempts++;
    
    console.log(`Reconnection attempt ${reconnectionAttempts} scheduled in ${backoffDelay}ms`);
    reconnectTimer = setTimeout(connectToBackground, backoffDelay);
  }
}

// Start the heartbeat ping-pong with background script
function startHeartbeat() {
  if (pingTimer) {
    clearInterval(pingTimer);
  }
  
  // Send a ping every 10 seconds
  pingTimer = setInterval(() => {
    if (isConnected && port) {
      try {
        // Check if we haven't received a pong in too long
        const now = Date.now();
        if (now - lastPongTime > 30000) { // 30 seconds
          console.log('No pong received for too long, reconnecting...');
          handleConnectionLost();
          return;
        }
        
        // Send a ping
        port.postMessage({ type: 'PANEL_PING' });
        
        // Set a timeout to detect if ping doesn't get a response
        if (pingTimeoutTimer) {
          clearTimeout(pingTimeoutTimer);
        }
        pingTimeoutTimer = setTimeout(() => {
          console.log('Ping timeout, reconnecting...');
          handleConnectionLost();
        }, 5000); // 5 second timeout for ping response
      } catch (e) {
        console.error('Error sending ping:', e);
        handleConnectionLost();
      }
    }
  }, 10000); // Ping every 10 seconds
}

// Stop the heartbeat
function stopHeartbeat() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  
  if (pingTimeoutTimer) {
    clearTimeout(pingTimeoutTimer);
    pingTimeoutTimer = null;
  }
}

// Handle a lost connection
function handleConnectionLost() {
  isConnected = false;
  stopHeartbeat();
  
  // Update connection indicator
  if (connectionIndicator) {
    connectionIndicator.classList.add('disconnected');
  }
  
  // Show reconnection message
  showReconnectionStatus(true);
  
  // Try to reconnect
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  reconnectTimer = setTimeout(connectToBackground, 1000);
}

// Function to show/hide reconnection status message
function showReconnectionStatus(isReconnecting) {
  let statusEl = document.getElementById('reconnection-status');
  
  if (isReconnecting) {
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'reconnection-status';
      statusEl.className = 'reconnection-status';
      statusEl.textContent = 'Connection to extension service worker lost. Reconnecting...';
      document.body.appendChild(statusEl);
    }
    
    // Update connection indicator
    if (connectionIndicator) {
      connectionIndicator.classList.add('disconnected');
    }
  } else if (statusEl) {
    statusEl.remove();
    
    // Update connection indicator
    if (connectionIndicator) {
      connectionIndicator.classList.remove('disconnected');
    }
  }
}

// Function to request message history
function requestMessageHistory() {
  if (port && isConnected) {
    try {
      port.postMessage({
        type: 'REQUEST_HISTORY'
      });
    } catch (error) {
      console.error('Error requesting history:', error);
      isConnected = false;
      
      // Connection might be broken, try to reconnect
      handleConnectionLost();
    }
  }
}

// Function to handle messages from background script
function handleBackgroundMessage(message) {
  // Handle ping/pong for heartbeat
  if (message.type === 'PANEL_PONG' || message.type === 'PING') {
    // Update the last pong time
    lastPongTime = Date.now();
    
    // Clear the ping timeout if it exists
    if (pingTimeoutTimer) {
      clearTimeout(pingTimeoutTimer);
      pingTimeoutTimer = null;
    }
    return;
  }
  
  if (message.type === 'NEW_MESSAGE') {
    // Add new message only if not paused
    if (!isPaused) {
      messages.push(message.message);
      applyFilters();
    }
    return;
  } else if (message.type === 'HISTORY_UPDATED') {
    // Replace messages with history
    messages = message.messages || [];
    applyFilters();
  }
}

// Set up an auto-reconnect timer to handle service worker restarts
setInterval(() => {
  if (!isConnected && reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
    console.log('Auto-reconnect check triggered');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    reconnectTimer = setTimeout(connectToBackground, 1000);
  }
}, 20000); // Check every 20 seconds

// Initialize connection
connectToBackground();

// Messages array
let messages = [];
// Filtered messages
let filteredMessages = [];

// Options
let options = {
  preserveLog: true,
  filters: {
    origin: '',
    content: ''
  }
};

// Format value for display
function formatValue(value) {
  try {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    
    return String(value);
  } catch (e) {
    return '<Error displaying value>';
  }
}

// Create message element
function createMessageElement(message) {
  const el = document.createElement('div');
  el.className = 'message-item';
  
  const timestamp = new Date(message.timestamp).toLocaleTimeString();
  
  const header = document.createElement('div');
  header.innerHTML = `
    <span class="timestamp">${timestamp}</span>
    <span class="source">${message.source}</span>
    received from
    <span class="origin">${message.origin}</span>
  `;
  
  // Create data preview container
  const dataPreview = document.createElement('div');
  dataPreview.className = 'data-preview collapsed';
  
  // Create toggle indicator
  const expandToggle = document.createElement('div');
  expandToggle.className = 'expand-toggle';
  expandToggle.textContent = '▶';
  
  // Create content container with pre tag for proper formatting
  const jsonContent = document.createElement('pre');
  jsonContent.className = 'json-content';
  jsonContent.textContent = formatValue(message.data);
  
  // Add toggle and content to preview
  dataPreview.appendChild(expandToggle);
  dataPreview.appendChild(jsonContent);
  
  // Remove click listener from dataPreview and only make the toggle clickable
  expandToggle.addEventListener('click', function(e) {
    // Toggle the expand/collapse state
    dataPreview.classList.toggle('collapsed');
    dataPreview.classList.toggle('expanded');
    expandToggle.textContent = dataPreview.classList.contains('expanded') ? '▼' : '▶';
    e.stopPropagation();
  });
  
  el.appendChild(header);
  el.appendChild(dataPreview);
  
  return el;
}

// Apply filters to messages
function applyFilters() {
  const originFilter = options.filters.origin.toLowerCase();
  const contentFilter = options.filters.content.toLowerCase();
  
  // First apply development filters to all messages (hidden from user)
  const devFilteredMessages = messages.filter(message => {
    // Filter out messages that match development patterns
    return window.DEV_FILTER_PATTERNS ? !window.DEV_FILTER_PATTERNS.shouldFilter(message) : true;
  });
  
  // Then apply user-defined filters
  if (!originFilter && !contentFilter) {
    // No user filters, show all messages that passed dev filters
    filteredMessages = [...devFilteredMessages];
  } else {
    // Apply user filters to already dev-filtered messages
    filteredMessages = devFilteredMessages.filter(message => {
      const matchesOrigin = !originFilter || 
        message.origin.toLowerCase().includes(originFilter);
      
      let matchesContent = true;
      if (contentFilter) {
        const messageContent = JSON.stringify(message.data).toLowerCase();
        matchesContent = messageContent.includes(contentFilter);
      }
      
      return matchesOrigin && matchesContent;
    });
  }
  
  renderMessages();
}

// Render messages
function renderMessages() {
  // Clear messages container
  messagesContainer.innerHTML = '';
  
  const messagesToRender = filteredMessages;
  
  // Show empty state if no messages
  if (messagesToRender.length === 0) {
    if (messages.length === 0) {
      messagesContainer.appendChild(emptyState);
    } else {
      const noMatchesEl = document.createElement('div');
      noMatchesEl.className = 'empty-state';
      noMatchesEl.innerHTML = '<h3>No matching messages</h3><p>Try adjusting your filters to see more messages.</p>';
      messagesContainer.appendChild(noMatchesEl);
    }
    return;
  }
  
  // Add message elements
  messagesToRender.forEach(message => {
    messagesContainer.appendChild(createMessageElement(message));
  });
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Clear button click
clearButton.addEventListener('click', function() {
  // Clear messages locally
  messages = [];
  filteredMessages = [];
  renderMessages();
  
  // Send clear command to background
  try {
    if (port && isConnected) {
      port.postMessage({
        type: 'CLEAR_HISTORY'
      });
    }
  } catch (error) {
    console.error('Error sending clear command:', error);
    // Try to reconnect
    isConnected = false;
    handleConnectionLost();
  }
});

// Preserve log change
preserveLogCheckbox.addEventListener('change', function() {
  options.preserveLog = preserveLogCheckbox.checked;
});

// Toggle filter panel
filterButton.addEventListener('click', function() {
  filterContainer.classList.toggle('visible');
  if (filterContainer.classList.contains('visible')) {
    originFilterInput.focus();
  }
});

// Pause/resume button click
pauseButton.addEventListener('click', togglePause);

// Apply filter
applyFilterButton.addEventListener('click', function() {
  options.filters.origin = originFilterInput.value.trim();
  options.filters.content = contentFilterInput.value.trim();
  applyFilters();
});

// Reset filter
resetFilterButton.addEventListener('click', function() {
  originFilterInput.value = '';
  contentFilterInput.value = '';
  options.filters.origin = '';
  options.filters.content = '';
  applyFilters();
});

// Filter on Enter key press
originFilterInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    applyFilterButton.click();
  }
});

contentFilterInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    applyFilterButton.click();
  }
});

// Initialize UI state
preserveLogCheckbox.checked = options.preserveLog;
// Initialize filtered messages
filteredMessages = [...messages];

// Refresh when navigating to a new page (if not preserving logs)
chrome.devtools.network.onNavigated.addListener(function() {
  if (!options.preserveLog) {
    messages = [];
    filteredMessages = [];
    renderMessages();
  }
});

// Set up visibility change detection to reconnect when tab becomes visible
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && !isConnected) {
    console.log('Tab became visible, attempting reconnect');
    connectToBackground();
  }
});

// Function to toggle pause/resume state
function togglePause() {
  isPaused = !isPaused;
  
  if (isPaused) {
    pauseButton.innerHTML = '▶️';
    pauseButton.title = 'Resume tracking';
  } else {
    pauseButton.innerHTML = '⏸️';
    pauseButton.title = 'Pause tracking';
  }
} 