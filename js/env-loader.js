/**
 * @fileoverview This script is responsible for loading environment variables for local development.
 * It fetches a `.env` file from the root of the project, parses its contents,
 * and makes the variables available globally on the `window._env` object.
 * This allows developers to use a standard `.env` file for configuration without a Node.js environment.
 */

/**
 * An Immediately Invoked Function Expression (IIFE) to encapsulate the logic
 * and avoid polluting the global scope with intermediate variables.
 */
(function() {
    // Create a namespace on the window object to hold the loaded environment variables.
  window._env = {};
  
    /**
   * Parses the text content of a .env file into a JavaScript object.
   * - Ignores empty lines and lines starting with '#'.
   * - Trims whitespace from keys and values.
   * - Handles values with or without quotes.
   *
   * @param {string} content The raw text from the .env file.
   * @returns {Object} An object containing the key-value pairs.
   */
  function parseEnv(content) {
    const lines = content.split('\n');
    const env = {};
    
        for (const line of lines) {
            // Ignore comments and blank lines
      if (!line || line.startsWith('#')) continue;
      
            // Use a regular expression to capture the key and value
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
                let value = match[2] || '';
        
                // Clean up quotes from the value
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        
                env[key] = value;
      }
    }
    
    return env;
  }
  
    /**
   * Fetches the .env file from the server root.
   * If successful, it parses the content and populates `window._env`.
   * It handles cases where the file might not exist, ensuring the app doesn't break.
   */
  fetch('.env')
    .then(response => {
            if (!response.ok) {
                console.log('No .env file found. Using default configuration values.');
                return '';
      }
            return response.text();
    })
    .then(content => {
            if (content) {
                window._env = parseEnv(content);
                console.log('Environment variables loaded from .env file.');
      }
    })
    .catch(error => {
            console.warn('Failed to load .env file.', error);
    });
})();
