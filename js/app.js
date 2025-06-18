/**
 * @fileoverview This file contains the core logic for the Photo Sharing application.
 * It defines the main Alpine.js component that manages the UI state, handles user interactions,
 * fetches photo data from the backend, and manages the photo upload process.
 */

/**
 * Initializes Alpine.js with our application logic.
 * This sets up the reactive data and methods for our UI.
 * This is executed before the DOM Content Loaded event.
 */
document.addEventListener("alpine:init", () => {
  // Log that Alpine is initializing - helps debug authentication flow
  console.log('Alpine.js initializing, current auth status:', window.authStatus);
  /**
   * The main Alpine.js data component for the application.
   * This object holds all the reactive state and methods that drive the UI.
   */
  Alpine.data('app', () => ({
    // --- Reactive State Properties ---

    /**
     * Authentication status, reactively bound to the UI.
     * @type {boolean}
     */
    isAuthenticated: window.authStatus.isAuthenticated,
    /**
     * The authenticated user's name.
     * @type {string}
     */
    username: window.authStatus.username,
    /**
     * Track authentication loading state for UI feedback.
     * @type {boolean}
     */
    authLoading: window.authStatus.loading,

    /**
     * An array to hold the list of photos fetched from the backend.
     * @type {Array<Object>}
     */
    photos: [],
    /**
     * Flag to indicate when photos are being loaded.
     * @type {boolean}
     */
    loading: true,
    /**
     * Stores any error messages from API calls.
     * @type {string|null}
     */
    error: null,

    /**
     * The file selected for upload.
     * @type {File|null}
     */
    fileToUpload: null,
    /**
     * Flag to indicate when an upload is in progress.
     * @type {boolean}
     */
    uploading: false,
    /**
     * The progress of the current upload, from 0 to 100.
     * @type {number}
     */
    uploadProgress: 0,
    /**
     * Stores any error messages related to the upload process.
     * @type {string|null}
     */
    uploadError: null,
    /**
     * Flag to indicate a successful upload.
     * @type {boolean}
     */
    uploadSuccess: false,

    /**
     * Indicates whether an image is currently being processed after upload.
     * @type {boolean}
     */
    processingImage: false,
    
    /**
     * The progress percentage of image processing (0-100).
     * @type {number}
     */
    processingProgress: 0,
    
    /**
     * Processing status message for user feedback.
     * @type {string}
     */
    processingMessage: '',

    /**
     * Flag to control the visibility of the photo modal.
     * @type {boolean}
     */
    showModal: false,
    /**
     * The photo object currently displayed in the modal.
     * @type {Object|null}
     */
    selectedPhoto: null,
    /**
     * Flag to show a loading spinner inside the modal while the full-size image loads.
     * @type {boolean}
     */
    modalLoading: false,

    // --- Initialization ---

    /**
     * The `init` method is called automatically by Alpine.js when the component is initialized.
     * It sets up listeners and performs initial data fetching.
     */
    init() {
      console.log('Initializing Alpine.js app component with auth status:', window.authStatus);
      
      // Wait for the window to load, and then immediately check if we have an authorization code in the URL
      window.addEventListener("load", () => {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get("code");
        
        if (authCode) {
          console.log('Found auth code in URL, app.js detected redirect from Cognito');
          
          // Force auth status check when we detect a code parameter
          window.authStatus.loading = true;
          
          // Allow UI to update with loading state first before checking auth
          setTimeout(() => {
            console.log('Triggering auth check from app.js...');
            window.checkAuthFromHash && window.checkAuthFromHash();
          }, 200);
        }
      });

      // Set up a listener to react to changes in the global authentication state.
      // This ensures the UI updates automatically on login/logout and during authentication.
      window.addEventListener('auth:statusChanged', () => {
        console.log('Auth status changed event received, new status:', window.authStatus);
        
        // Update component state from global auth status
        this.isAuthenticated = window.authStatus.isAuthenticated;
        this.username = window.authStatus.username;
        this.authLoading = window.authStatus.loading;
        
        // Handle state changes based on authentication status
        if (this.isAuthenticated) {
          console.log('User is authenticated, fetching photos...');
          this.fetchPhotos();
        } else if (!this.authLoading) {
          console.log('User is not authenticated and not in loading state, clearing photos');
          this.photos = []; // Clear photos on logout, but not during auth process
        }
      });

      // Always ensure our component state is in sync with the global auth state
      this.isAuthenticated = window.authStatus.isAuthenticated;
      this.username = window.authStatus.username;
      this.authLoading = window.authStatus.loading;
      
      // If the user is already authenticated on page load, fetch their photos.
      if (this.isAuthenticated) {
        console.log('User is authenticated on init, fetching photos...');
        this.fetchPhotos();
      }
    },

    // --- Photo Gallery Methods ---

    /**
     * Fetches the list of photos from the backend API.
     * It handles loading states, errors, and parsing the XML response.
     */
    async fetchPhotos() {
      this.loading = true;
      this.error = null;
      try {
        // Fetch photo data from the API endpoint defined in the global configuration.
        const photosEndpoint = window.AppConfig.api.photos_endpoint;
        console.log('Fetching photos from endpoint:', photosEndpoint);
        const response = await fetch(photosEndpoint);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        
        // The API returns JSON data with photo information
        const data = await response.json();
        console.log('Photo data received:', data);
        
        // Check if the data has the expected structure
        if (data && data.Items && Array.isArray(data.Items)) {
          // Convert the API response into our photo objects array
          this.photos = data.Items.map(item => {
            const thumbnailURL = item.ThumbnailURL ? item.ThumbnailURL.S : '';
            const originalURL = item.OriginalImageURL ? item.OriginalImageURL.S : '';
            const photoId = item.ImageMetadataPK ? item.ImageMetadataPK.S : '';
            
            // Extract metadata if available
            let metadata = {};
            if (item.Metadata && item.Metadata.M) {
              if (item.Metadata.M.Format && item.Metadata.M.Format.S) {
                metadata.format = item.Metadata.M.Format.S;
              }
              if (item.Metadata.M.Mode && item.Metadata.M.Mode.S) {
                metadata.mode = item.Metadata.M.Mode.S;
              }
              if (item.Metadata.M.Size && item.Metadata.M.Size.L && 
                  item.Metadata.M.Size.L[0] && item.Metadata.M.Size.L[1]) {
                metadata.width = parseInt(item.Metadata.M.Size.L[0].N, 10);
                metadata.height = parseInt(item.Metadata.M.Size.L[1].N, 10);
              }
            }
            
            return {
              id: photoId,
              thumbnailUrl: thumbnailURL,
              url: originalURL,
              metadata: metadata
            };
          });
          
          console.log('Processed photos:', this.photos);
        } else {
          console.error('Unexpected API response format:', data);
          this.error = 'Unexpected API response format';
          this.photos = [];
        }
      } catch (err) {
        this.error = `Failed to fetch photos: ${err.message}`;
        console.error(err);
      } finally {
        this.loading = false;
      }
    },

    // --- Upload Methods ---

    /**
     * Handles the file selection event from the input field.
     * @param {Event} event The file input change event.
     */
    handleFileSelect(event) {
      this.fileToUpload = event.target.files[0];
      this.uploadError = null;
      this.uploadSuccess = false;
      if (this.fileToUpload) {
        console.log(`File selected: ${this.fileToUpload.name}`);
      }
    },

    /**
     * Orchestrates the file upload process.
     * It gets a pre-signed URL and then uploads the file to S3.
     */
    async uploadFile() {
      if (!this.fileToUpload) {
        this.uploadError = 'Please select a file to upload.';
        return;
      }

      this.uploading = true;
      this.uploadProgress = 0;
      this.uploadError = null;
      this.uploadSuccess = false;

      try {
        // 1. Request a pre-signed URL from our backend API.
        const presignedUrl = await this.getPresignedUrl(this.fileToUpload);
        // 2. Upload the file to S3 using the pre-signed URL.
        await this.uploadToS3(presignedUrl, this.fileToUpload);

        this.uploadSuccess = true;
        this.fileToUpload = null; // Reset file input
        
        // Start image processing monitoring
        this.startImageProcessingMonitor()
      } catch (err) {
        this.uploadError = `Upload failed: ${err.message}`;
        console.error(err);
      } finally {
        this.uploading = false;
      }
    },

    /**
     * Fetches a pre-signed URL from the backend API.
     * @param {File} file The file to be uploaded.
     * @returns {Promise<string>} A promise that resolves with the pre-signed URL.
     */
    async getPresignedUrl(file) {
      console.log('Getting presigned URL for file:', file.name);
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;
      
      // Use the direct upload endpoint from AppConfig with the filename appended
      // This will perform a direct PUT upload to the S3 bucket through API Gateway
      const uploadEndpoint = window.AppConfig.api.upload_endpoint;
      const url = `${uploadEndpoint}${fileName}`;
      
      console.log('Generated upload URL:', url);
      
      // In this case, we're directly using the API Gateway endpoint that allows PUT requests
      // No need to get a presigned URL separately
      return url;
    },

    /**
     * Uploads the file to S3 using the provided pre-signed URL.
     * @param {string} presignedUrl The URL for the S3 upload.
     * @param {File} file The file to upload.
     * @returns {Promise<void>} A promise that resolves when the upload is complete.
     */
    uploadToS3(presignedUrl, file) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        
        // Add content type header based on file type
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        
        // Add authorization header if we have a token
        if (window.authStatus && window.authStatus.token) {
          console.log('Adding authorization header for upload');
          xhr.setRequestHeader('Authorization', `Bearer ${window.authStatus.token}`);
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            this.uploadProgress = Math.round((event.loaded / event.total) * 100);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('Upload successful!');
            resolve();
          } else {
            console.error('Upload failed:', xhr.status, xhr.statusText, xhr.responseText);
            reject(new Error(`Upload failed with status: ${xhr.status} - ${xhr.statusText}`));
          }
        };

        xhr.onerror = (error) => {
          console.error('Upload network error:', error);
          reject(new Error('A network error occurred during the upload.'));
        };

        console.log('Sending file:', file.name, 'to URL:', presignedUrl);
        xhr.send(file);
      });
    },

    // --- Modal Methods ---

    /**
     * Opens the modal to display a selected photo in full size.
     * @param {Object} photo The photo object to display.
     */
    openPhotoModal(photo) {
      this.selectedPhoto = photo;
      this.modalLoading = true;
      this.showModal = true;

      const img = new Image();
      img.src = photo.url;
      img.onload = () => {
        this.modalLoading = false;
      };
      img.onerror = () => {
        console.error('Failed to load full-size image for modal.');
        this.modalLoading = false;
      };
    },

    /**
     * Closes the photo modal and resets its state.
     */
    closePhotoModal() {
      this.showModal = false;
      setTimeout(() => {
        this.selectedPhoto = null;
        this.modalLoading = false;
      }, 300); // Should match the modal's closing transition duration
    },

    /**
     * Monitors image processing and automatically refreshes the gallery.
     * AWS Lambda processing typically takes about a minute to complete.
     */
    startImageProcessingMonitor() {
      // Set a processing state to show appropriate UI
      this.processingImage = true;
      this.processingProgress = 0;
      this.processingMessage = 'Processing image... This typically takes about 60 seconds';
      
      // Store the initial count of photos
      const initialPhotoCount = this.photos.length;
      
      // Create a counter for our progress bar
      let elapsed = 0;
      const totalExpectedTime = 60; // 60 seconds expected processing time
      
      // Check for new photos every 10 seconds
      const checkInterval = setInterval(async () => {
        elapsed += 10;
        
        // Update progress percentage (capped at 95% until complete)
        this.processingProgress = Math.min(Math.round((elapsed / totalExpectedTime) * 100), 95);
        
        // Attempt to fetch photos
        await this.fetchPhotos();
        
        // If we have a new photo or the expected time has elapsed
        if (this.photos.length > initialPhotoCount || elapsed >= totalExpectedTime + 10) {
          // Clear the interval
          clearInterval(checkInterval);
          
          // Complete the progress
          this.processingProgress = 100;
          this.processingMessage = 'Image processing complete!';
          
          // Reset the processing state after showing completion message
          setTimeout(() => {
            this.processingImage = false;
            
            // Show success message briefly
            setTimeout(() => {
              // Reset upload success flag after showing the message for a few seconds
              this.uploadSuccess = false;
            }, 5000);
          }, 2000);
        }
      }, 10000); // Check every 10 seconds
    },
    
    // --- Utility Methods ---
    
    /**
     * Handles image loading errors by setting a fallback image
     * @param {Event} event The error event
     * @param {number} index The photo index
     */
    handleImageError(event, index) {
      console.error(`Image loading failed for photo at index ${index}`);
      // Set a placeholder image
      event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxyZWN0IGZpbGw9IiNFRUVFRUUiIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiByeD0iNCIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDcwLjU2MiA2OC41NjIpIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iMyI+PGNpcmNsZSBjeD0iOS41IiBjeT0iOS41IiByPSI5LjUiLz48cGF0aCBkPSJNMzkuNDM4IDU5LjQzOEw5LjUgOS41Ii8+PGNpcmNsZSBjeD0iMzkuNDM4IiBjeT0iNTkuNDM4IiByPSI5LjUiLz48L2c+PC9nPjwvc3ZnPg==';
      // Add a CSS class to indicate broken image
      event.target.classList.add('broken-image');
    },

    /**
     * Formats a file size in bytes into a human-readable string (KB, MB).
     * @param {number} bytes The size in bytes.
     * @returns {string} The formatted size string.
     */
    formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  }));
});
