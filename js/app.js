/**
 * @fileoverview This file contains the core logic for the Photo Sharing application.
 * It defines the main Alpine.js component that manages the UI state, handles user interactions,
 * fetches photo data from the backend, and manages the photo upload process.
 */

document.addEventListener('alpine:init', () => {
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
      // Set up a listener to react to changes in the global authentication state.
      // This ensures the UI updates automatically on login/logout and during authentication.
      window.addEventListener('auth:statusChanged', () => {
        this.isAuthenticated = window.authStatus.isAuthenticated;
        this.username = window.authStatus.username;
        this.authLoading = window.authStatus.loading;
        
        if (this.isAuthenticated) {
          this.fetchPhotos();
        } else if (!this.authLoading) {
          this.photos = []; // Clear photos on logout, but not during auth process
        }
      });

      // If the user is already authenticated on page load, fetch their photos.
      if (this.isAuthenticated) {
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
        const response = await fetch(window.AppConfig.api.photos);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const str = await response.text();
        // The API returns XML, so we need to parse it to extract the photo data.
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(str, 'application/xml');
        const contents = xmlDoc.getElementsByTagName('Contents');
        // Convert the XML nodes into a more friendly array of JavaScript objects.
        this.photos = Array.from(contents).map(content => ({
          key: content.getElementsByTagName('Key')[0].textContent,
          url: `${window.AppConfig.api.photos}/${content.getElementsByTagName('Key')[0].textContent}`,
          lastModified: content.getElementsByTagName('LastModified')[0].textContent,
          size: content.getElementsByTagName('Size')[0].textContent
        }));
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
        await this.fetchPhotos(); // Refresh the gallery
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
      const params = new URLSearchParams({ fileName: file.name, contentType: file.type });
      const url = `${window.AppConfig.api.upload}?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          // If using an authorizer like Cognito on your API Gateway, add the token here
          // 'Authorization': `Bearer ${window.authStatus.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Could not get a pre-signed URL.');
      }
      const data = await response.json();
      return data.uploadURL;
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

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            this.uploadProgress = Math.round((event.loaded / event.total) * 100);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`S3 upload failed with status: ${xhr.status} - ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('A network error occurred during the upload.'));
        };

        xhr.send(file);
      });
    },

    // --- Modal Methods ---

    /**
     * Opens the modal to display a selected photo in full size.
     * @param {Object} photo The photo object to display.
     */
    openModal(photo) {
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
    closeModal() {
      this.showModal = false;
      setTimeout(() => {
        this.selectedPhoto = null;
        this.modalLoading = false;
      }, 300); // Should match the modal's closing transition duration
    },

    // --- Utility Methods ---

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
