/**
 * Development-only filter patterns for postMessage events
 * These patterns are used to automatically filter out noise from browser extensions
 * and development tools to keep the log cleaner during development.
 * 
 * Patterns support wildcards (*) for matching multiple characters
 */

const DEV_FILTER_PATTERNS = {
  // Source patterns to exclude (supports wildcards)
  excludedSources: [
    'react-devtools-*',
    'bitwarden-*'
  ],
  
  // Convert a wildcard pattern to a regex pattern
  patternToRegex: function(pattern) {
    return new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
  },
  
  // Check if a string matches any of the patterns (with wildcard support)
  matchesPattern: function(str, patterns) {
    return patterns.some(pattern => {
      // Check for wildcard
      if (pattern.includes('*')) {
        return this.patternToRegex(pattern).test(str);
      }
      // Simple case-insensitive includes check for patterns without wildcards
      return str.toLowerCase().includes(pattern.toLowerCase());
    });
  },
  
  // Check if a message should be filtered out
  shouldFilter: function(message) {
    // Check source patterns in message.data
    if (message.data) {
      // Case 1: message.data is an object with a source property
      if (typeof message.data === 'object' && message.data.source) {
        if (this.matchesPattern(message.data.source, this.excludedSources)) {
          return true;
        }
      }
      
      // Case 2: message.data might be a string containing source info
      // This is a safety check in case data is serialized
      if (typeof message.data === 'string') {
        try {
          const parsedData = JSON.parse(message.data);
          if (parsedData && parsedData.source && 
              this.matchesPattern(parsedData.source, this.excludedSources)) {
            return true;
          }
        } catch (e) {
          // If it's not valid JSON, check if the string itself contains our patterns
          if (this.excludedSources.some(pattern => 
              message.data.toLowerCase().includes(pattern.toLowerCase().replace('*', '')))) {
            return true;
          }
        }
      }
    }
    
    // Also check direct message.source (as fallback)
    if (message.source && this.matchesPattern(message.source, this.excludedSources)) {
      return true;
    }
    
    // Final fallback: stringify entire message data and check for patterns
    // This will catch cases where the structure varies or is nested differently
    try {
      const messageStr = JSON.stringify(message.data);
      for (const pattern of this.excludedSources) {
        const searchPattern = pattern.replace('*', ''); // Remove wildcards for simple search
        if (searchPattern && messageStr.toLowerCase().includes(searchPattern.toLowerCase())) {
          return true;
        }
      }
    } catch (e) {
      // If stringify fails, ignore this check
    }
    
    return false;
  }
};

// For browser context
window.DEV_FILTER_PATTERNS = DEV_FILTER_PATTERNS; 