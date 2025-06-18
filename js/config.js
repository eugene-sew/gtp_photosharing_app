/**
 * Safely retrieves an environment variable from different sources with a fallback default value.
 * The order of precedence is:
 * 1. `process.env` (for Node.js environments, e.g., during a build process).
 * 2. `window._env` (for local development, populated by `env-loader.js` from a .env file).
 * 3. A hardcoded default value.
 */
const getEnv = (key, defaultValue = "") => {
  // 1. Check for Node.js environment variables (e.g., from build tools)
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key];
  }

  // 2. Check for variables loaded from .env file for local development
  if (window._env && window._env[key]) {
    return window._env[key];
  }

  // 3. Fallback to the default value
  return defaultValue;
};

/**
 * The main configuration object for the application.
 * It is structured to group related settings, such as Cognito, API endpoints, etc.
 * This object is populated using the `getEnv` function to ensure flexibility.
 */
const CONFIG = {
  // AWS Cognito settings for user authentication
  cognito: {
    UserPoolId: getEnv("COGNITO_USER_POOL_ID", "us-east-1_io9CtBusD"),
    ClientId: getEnv("COGNITO_CLIENT_ID", "8au96ta14667pdcgfagc6a3n4"),
    Region: getEnv("COGNITO_REGION", "us-east-1"),
    IdentityPoolId: getEnv(
      "COGNITO_IDENTITY_POOL_ID",
      "us-east-1:ae0ab6d6-df6b-4326-90e6-3d6676d63575"
    ),
  },
  // The domain for the Cognito Hosted UI
  cognito_domain: getEnv("COGNITO_DOMAIN", "us-east-1io9ctbusd"),
  // The URI to redirect to after successful authentication
  redirect_uri: getEnv("REDIRECT_URI", "https://d84l1y8p4kdic.cloudfront.net"),
  // API endpoints for backend services
  api: {
    // Endpoint for fetching photo metadata
    photos_endpoint: getEnv(
      "API_PHOTOS_ENDPOINT",
      "https://hj9ps33iv0.execute-api.us-east-1.amazonaws.com/prod/photos/"
    ),
    // Endpoint for generating pre-signed URLs for photo uploads
    upload_endpoint: getEnv(
      "API_UPLOAD_ENDPOINT",
      "https://0akv8smyga.execute-api.us-east-1.amazonaws.com/prod/photo-sharing-test-bkt/"
    ),
  },
};

// Expose the configuration object globally on the window object.
// This makes it easily accessible from other scripts (e.g., auth.js, app.js)
// without needing to import it, which is convenient for this static project setup.
window.AppConfig = CONFIG;
