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
const COGNITO_LOGIN_URL = `https://${window.AppConfig.cognito_domain}.auth.${
  window.AppConfig.cognito.Region
}.amazoncognito.com/login?client_id=${
  window.AppConfig.cognito.ClientId
}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(
  window.AppConfig.redirect_uri
)}`;

/**
 * The URL for the AWS Cognito Hosted UI sign-up page.
 * It uses the same parameters as the login URL to ensure a consistent user experience.
 */
const COGNITO_REGISTER_URL = `https://${window.AppConfig.cognito_domain}.auth.${
  window.AppConfig.cognito.Region
}.amazoncognito.com/signup?client_id=${
  window.AppConfig.cognito.ClientId
}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(
  window.AppConfig.redirect_uri
)}`;

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
  loading: false,
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
 * 
 * This function is exposed globally so it can be called from app.js when needed.
 */
window.checkAuthFromHash = function() {
  // Start with loading state - this is handled differently to ensure UI updates properly
  window.authStatus.loading = true;

  // 1. Handle the redirect from Cognito after a successful login.
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get("code");

  if (authCode) {
    console.log("Authorization code received from Cognito:", authCode);
    // In a production environment, this authorization code would typically be
    // exchanged for tokens via a backend service. For this demo, we'll use it directly.

    // Extract some information from the auth code to simulate a real token
    // The real code would be exchanged for actual tokens via a token endpoint
    const authData = {
      username: "Authenticated User",
      // We're using the actual auth code as part of the token to make it unique per session
      token: "cognito-token-" + authCode.substring(0, 8),
      id_token: "id-" + authCode,
      access_token: "access-" + authCode,
      expires_in: 3600,
    };

    // Set the authenticated user with our auth data
    setAuthenticatedUser(authData);

    // Add a console log to help debug the authentication state
    console.log(
      "Authentication successful, updated auth status:",
      window.authStatus
    );

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
  console.log('Setting authenticated user with token data:', tokenData);
  
  // Set token expiry (default to 1 hour if not provided)
  const expiresIn = tokenData.expires_in
    ? parseInt(tokenData.expires_in, 10)
    : 3600;
  const expiryTime = new Date();
  expiryTime.setSeconds(expiryTime.getSeconds() + expiresIn);

  // Extract username from token (simplified - in a real app you'd decode the JWT)
  // In a real implementation you'd use a JWT library to decode the token
  let username = "User";
  if (tokenData.username) {
    username = tokenData.username;
  } else if (tokenData.id_token) {
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

  // Update global auth status - we need to do this completely before dispatching the event
  window.authStatus = {
    isAuthenticated: true,
    username: username,
    token: tokenData.id_token || tokenData.access_token || tokenData.token,
    tokenExpiry: expiryTime.toISOString(),
    loading: false,
  };
  
  console.log('Updated auth status, user is now authenticated:', window.authStatus);

  // Save to localStorage
  localStorage.setItem("photoGalleryAuth", JSON.stringify(window.authStatus));

  // Configure AWS credentials if using Cognito Identity Pool
  if (window.AppConfig && window.AppConfig.cognito && window.AppConfig.cognito.IdentityPoolId) {
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
      IdentityPoolId: window.AppConfig.cognito.IdentityPoolId,
      Logins: {
        [`cognito-idp.${window.AppConfig.cognito.Region}.amazonaws.com/${window.AppConfig.cognito.UserPoolId}`]:
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
    loading: false,
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
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, checking auth status...');
  
  // First initialize AWS credentials
  initializeAWS();
  
  // Give Alpine.js a chance to initialize before we check auth
  setTimeout(() => {
    console.log('Running auth check after short delay');
    checkAuthFromHash();
    
    // Force an auth state change event to ensure UI updates
    window.dispatchEvent(authStatusChangedEvent);
  }, 200);

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
