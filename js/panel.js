// Panel script for postMessage DevTools

// DOM Elements
const messagesContainer = document.getElementById('messages');
const emptyState = document.getElementById('empty-state');
const clearButton = document.getElementById('clear-btn');
const preserveLogCheckbox = document.getElementById('preserve-log');
const filterButton = document.getElementById('filter-btn');
const filterContainer = document.getElementById('filter-container');
const originFilterInput = document.getElementById('origin-filter');
const contentFilterInput = document.getElementById('content-filter');
const applyFilterButton = document.getElementById('apply-filter');
const resetFilterButton = document.getElementById('reset-filter');

// Connect to the background script
const tabId = chrome.devtools.inspectedWindow.tabId;
let port;
let reconnectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 5;

// Function to establish connection with the background script
function connectToBackground() {
  try {
    port = chrome.runtime.connect({
      name: `postMessageDevTools-${tabId}`
    });
    
    console.log('Connected to background script');
    
    // Reset reconnection attempts on successful connection
    reconnectionAttempts = 0;
    
    // Handle messages from background script
    port.onMessage.addListener(handleBackgroundMessage);
    
    // Handle disconnection
    port.onDisconnect.addListener(() => {
      console.log('Disconnected from background script');
      
      // Check for error
      if (chrome.runtime.lastError) {
        console.error('Connection error:', chrome.runtime.lastError.message);
      }
      
      // Try to reconnect if not at max attempts
      if (reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
        reconnectionAttempts++;
        console.log(`Reconnection attempt ${reconnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS}`);
        
        // Attempt to reconnect with exponential backoff
        setTimeout(connectToBackground, 1000 * Math.pow(2, reconnectionAttempts - 1));
      } else {
        console.error('Max reconnection attempts reached');
        // Show error message in UI
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = 'Connection to extension lost. Please refresh the DevTools panel.';
        messagesContainer.appendChild(errorEl);
      }
    });
    
    // Request message history after connection
    requestMessageHistory();
  } catch (error) {
    console.error('Error connecting to background script:', error);
    // Try to reconnect if not at max attempts
    if (reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
      reconnectionAttempts++;
      setTimeout(connectToBackground, 1000 * Math.pow(2, reconnectionAttempts - 1));
    }
  }
}

// Function to request message history
function requestMessageHistory() {
  if (port) {
    try {
      port.postMessage({
        type: 'REQUEST_HISTORY'
      });
    } catch (error) {
      console.error('Error requesting history:', error);
      // Connection might be broken, try to reconnect
      connectToBackground();
    }
  }
}

// Function to handle messages from background script
function handleBackgroundMessage(message) {
  if (message.type === 'NEW_MESSAGE') {
    // Add new message
    messages.push(message.message);
    applyFilters();
  } else if (message.type === 'HISTORY_UPDATED') {
    // Replace messages with history
    messages = message.messages;
    applyFilters();
  }
}

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

// Format JSON value with syntax highlighting
function formatJSON(value) {
  try {
    let json = JSON.stringify(value, null, 2);
    
    // Add syntax highlighting
    json = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
          // Remove the colon from the key
          match = match.replace(/:$/, '');
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
    
    // Add colons back after keys
    json = json.replace(/<\/span>(\s*)/g, '</span><span>:</span>$1');
    
    return json;
  } catch (e) {
    return String(value);
  }
}

// Format value for display
function formatValue(value) {
  try {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    
    if (typeof value === 'object') {
      return formatJSON(value);
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
  
  // Create content container
  const jsonContent = document.createElement('div');
  jsonContent.className = 'json-content';
  jsonContent.innerHTML = formatValue(message.data);
  
  // Add toggle and content to preview
  dataPreview.appendChild(expandToggle);
  dataPreview.appendChild(jsonContent);
  
  // Toggle expand/collapse on click
  dataPreview.addEventListener('click', function(e) {
    dataPreview.classList.toggle('collapsed');
    dataPreview.classList.toggle('expanded');
    expandToggle.textContent = dataPreview.classList.contains('expanded') ? '▼' : '▶';
    
    // Stop event if clicking on the toggle itself (to prevent double toggle)
    if (e.target === expandToggle) {
      e.stopPropagation();
    }
  });
  
  // Make the toggle also clickable
  expandToggle.addEventListener('click', function(e) {
    dataPreview.click();
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
  
  if (!originFilter && !contentFilter) {
    // No filters, show all messages
    filteredMessages = [...messages];
  } else {
    // Apply filters
    filteredMessages = messages.filter(message => {
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
    if (port) {
      port.postMessage({
        type: 'CLEAR_HISTORY'
      });
    }
  } catch (error) {
    console.error('Error sending clear command:', error);
    // Try to reconnect
    connectToBackground();
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