/**
 * @fileoverview Manages all aspects of user authentication using AWS Cognito.
 * This includes handling the login flow, managing tokens, and maintaining the global authentication state.
 * It relies on the global `AppConfig` object (from `config.js`) for all Cognito-related settings.
 */
/**
 * The URL for the AWS Cognito Hosted UI login page.
 * It is dynamically constructed using settings from the `AppConfig` object.
 * This URL includes the client ID, response type (code for Authorization Code Grant flow),
 * requested scopes, and the redirect URI.
 */
const COGNITO_LOGIN_URL = `https://${window.AppConfig.cognito_domain}.auth.${window.AppConfig.cognito.Region}.amazoncognito.com/login?client_id=${window.AppConfig.cognito.ClientId}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(window.AppConfig.redirect_uri)}`;

/**
 * The URL for the AWS Cognito Hosted UI sign-up page.
 * It uses the same parameters as the login URL to ensure a consistent user experience.
 */
const COGNITO_REGISTER_URL = `https://${window.AppConfig.cognito_domain}.auth.${window.AppConfig.cognito.Region}.amazoncognito.com/signup?client_id=${window.AppConfig.cognito.ClientId}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(window.AppConfig.redirect_uri)}`;

/**
 * A global object to hold the application's authentication state.
 * This makes it easy for other parts of the application (like Alpine.js components)
 * to reactively check if a user is authenticated.
 */
window.authStatus = {
  isAuthenticated: false,
  username: "",
  token: "",
  tokenExpiry: null,
  loading: false
};

/**
 * A custom event that is dispatched whenever the authentication status changes (login or logout).
 * This allows different parts of the application to listen for and react to auth state changes.
 */
const authStatusChangedEvent = new Event("auth:statusChanged");

/**
 * Initializes the AWS SDK with the region specified in the configuration.
 * This is a prerequisite for any AWS service interactions.
 */
function initializeAWS() {
  AWS.config.region = window.AppConfig.cognito.Region;
}

/**
 * Checks the user's authentication status upon page load.
 * It prioritizes checking for an authorization code in the URL (from a Cognito redirect).
 * If no code is present, it falls back to checking for valid tokens in localStorage.
 */
function checkAuthFromHash() {
  // Start with loading state
  window.authStatus.loading = true;
  window.dispatchEvent(authStatusChangedEvent);
  
  // 1. Handle the redirect from Cognito after a successful login.
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get('code');
  
  if (authCode) {
    console.log('Authorization code received from Cognito');
    // NOTE: In a production environment, this authorization code would be sent to a secure backend
    // to be exchanged for JWT tokens. For this demo, we simulate a successful login.
    
    const mockAuthData = {
      username: 'Demo User',
      token: 'simulated-token-' + Math.random().toString(36).substring(2),
      expires_in: 3600
    };
    
    setAuthenticatedUser(mockAuthData);
    
    // Clean the URL to remove the authorization code, so it's not accidentally reused
    window.history.replaceState(null, null, window.location.pathname);
  } else {
      // 2. If not coming from a redirect, check for a session in localStorage.
    const savedAuth = localStorage.getItem("photoGalleryAuth");
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);

        // Check token expiry
        if (
          authData.tokenExpiry &&
          new Date(authData.tokenExpiry) > new Date()
        ) {
          setAuthenticatedUser(authData);
        } else {
          // Token expired
          clearAuthData();
        }
      } catch (err) {
        console.error("Error parsing saved auth data:", err);
        clearAuthData();
      }
    }
  }
  
  // Always ensure loading state is false after auth check completes
  window.authStatus.loading = false;
  window.dispatchEvent(authStatusChangedEvent);
}

/**
 * Sets the authenticated user data in the global authStatus object.
 * This is called after a successful authentication with Cognito.
 * @param {Object} tokenData - The token data received from Cognito
 */
function setAuthenticatedUser(tokenData) {
  // Set token expiry (default to 1 hour if not provided)
  const expiresIn = tokenData.expires_in
    ? parseInt(tokenData.expires_in, 10)
    : 3600;
  const expiryTime = new Date();
  expiryTime.setSeconds(expiryTime.getSeconds() + expiresIn);

  // Extract username from token (simplified - in a real app you'd decode the JWT)
  // In a real implementation you'd use a JWT library to decode the token
  let username = "User";
  if (tokenData.id_token) {
    try {
      // This is a simplified version - in production use a JWT decoder library
      const tokenParts = tokenData.id_token.split(".");
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        username = payload.name || payload.email || payload.username || "User";
      }
    } catch (err) {
      console.error("Error extracting username from token:", err);
    }
  }

  // Update global auth status
  window.authStatus = {
    isAuthenticated: true,
    username: username,
    token: tokenData.id_token || tokenData.access_token,
    tokenExpiry: expiryTime.toISOString(),
    loading: false
  };

  // Save to localStorage
  localStorage.setItem("photoGalleryAuth", JSON.stringify(window.authStatus));

  // Configure AWS credentials if using Cognito Identity Pool
  if (COGNITO_CONFIG.IdentityPoolId) {
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: COGNITO_CONFIG.IdentityPoolId,
      Logins: {
        [`cognito-idp.${COGNITO_CONFIG.Region}.amazonaws.com/${COGNITO_CONFIG.UserPoolId}`]:
          window.authStatus.token,
      },
    });
  }

  // Dispatch event to notify the app
  window.dispatchEvent(authStatusChangedEvent);
}

// Clear authentication data
function clearAuthData() {
  window.authStatus = {
    isAuthenticated: false,
    username: "",
    token: "",
    tokenExpiry: null,
    loading: false
  };

  localStorage.removeItem("photoGalleryAuth");

  // Dispatch event to notify the app
  window.dispatchEvent(authStatusChangedEvent);
}

/**
 * Logs the user out by clearing all authentication data and redirecting to the login page.
 */
window.logoutUser = function () {
  clearAuthData();
};

/**
 * Redirects the browser to the Cognito Hosted UI for login.
 */
window.redirectToLogin = function () {
  // Set loading state before redirect
  window.authStatus.loading = true;
  window.dispatchEvent(authStatusChangedEvent);
  
  // Short delay to allow the UI to update before redirect
  setTimeout(() => {
    window.location.href = COGNITO_LOGIN_URL;
  }, 100);
};

/**
 * Redirects the browser to the Cognito Hosted UI for registration.
 */
window.redirectToRegister = function () {
  // Set loading state before redirect
  window.authStatus.loading = true;
  window.dispatchEvent(authStatusChangedEvent);
  
  // Short delay to allow the UI to update before redirect
  setTimeout(() => {
    window.location.href = COGNITO_REGISTER_URL;
  }, 100);
};

// Perform initial authentication checks as soon as the DOM is ready.
document.addEventListener("DOMContentLoaded", () => {
  initializeAWS();
  checkAuthFromHash();

  // Set up an interval to check token expiry (every minute)
  setInterval(() => {
    if (window.authStatus.tokenExpiry) {
      const expiryTime = new Date(window.authStatus.tokenExpiry);
      if (expiryTime <= new Date()) {
        console.log("Token expired, logging out");
        clearAuthData();
      }
    }
  }, 60000);
});
