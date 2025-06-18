# Photo Sharing Gallery

A responsive photo sharing application built with Alpine.js and TailwindCSS that integrates with AWS Cognito for authentication.

## Features

- User authentication via AWS Cognito
- Photo gallery with thumbnail and full-size image viewing
- Image uploading with progress tracking
- Responsive design for all device sizes
- Modal view for full-size images

## API Endpoints

- Photos API: `https://hj9ps33iv0.execute-api.us-east-1.amazonaws.com/prod/photos/`
- Thumbnail bucket: `https://0akv8smyga.execute-api.us-east-1.amazonaws.com/prod/photo-sharing-thumbnail-bkt/`
- Main image bucket: `https://0akv8smyga.execute-api.us-east-1.amazonaws.com/prod/photo-sharing-test-bkt/`

## Setup Instructions

### 1. Environment Variable Configuration

The application uses environment variables for configuration. Follow these steps to set up:

1. Copy the `.env.example` file to `.env` in the root directory:

   ```
   cp .env.example .env
   ```

2. Edit the `.env` file with your own AWS Cognito and API endpoint values:

   ```
   # AWS Cognito Configuration
   COGNITO_USER_POOL_ID=your_user_pool_id
   COGNITO_CLIENT_ID=your_client_id
   COGNITO_REGION=your_region
   COGNITO_IDENTITY_POOL_ID=your_identity_pool_id
   COGNITO_DOMAIN=your_domain

   # Redirect URI for authentication
   REDIRECT_URI=your_redirect_uri

   # API Endpoints
   API_PHOTOS_ENDPOINT=your_photos_api_endpoint
   API_UPLOAD_ENDPOINT=your_upload_endpoint
   ```

3. The application will automatically load these environment variables when run locally.

### 2. Running the Application

Since this is a static website, you can use any static file server to run it locally. For example:

- Using Python's built-in server:
  ```
  python -m http.server
  ```
- Using Node.js with a package like `serve`:
  ```
  npx serve
  ```

### 3. Usage

1. Open the application in your browser
2. Login with your AWS Cognito credentials or register a new account
3. View the gallery of existing photos
4. Upload new photos using the upload section
5. Click on thumbnails to view full-size images

## Project Structure

- `index.html` - Main application with Alpine.js components
- `js/app.js` - Alpine.js application logic for gallery and uploads
- `js/auth.js` - AWS Cognito authentication logic
- `css/styles.css` - Custom styles beyond Tailwind

## Backend Image Processing Workflow

When a user uploads an image through the application, the following steps occur in the backend:

1.  **Upload to S3 via API Gateway**: The image is sent to an AWS API Gateway endpoint, which securely forwards it to a designated S3 bucket (original images bucket).
2.  **Thumbnail Generation (Lambda Trigger)**: The `PUT` event in the original images S3 bucket triggers an AWS Lambda function. This Lambda function is responsible for:
    - Resizing the uploaded image to create a thumbnail.
    - Placing the generated thumbnail into a separate S3 bucket (thumbnails bucket).
3.  **Metadata Storage (Lambda and DynamoDB)**: The `PUT` event in the thumbnails S3 bucket (caused by the thumbnail being saved) triggers a second AWS Lambda function. This Lambda function is responsible for:
    - Extracting metadata from the image (e.g., name, type, size).
    - Storing this metadata, along with the URLs for both the original image and the thumbnail, in an Amazon DynamoDB table.
4.  **Data Retrieval (API Gateway and DynamoDB)**: The application fetches the list of photos (including their metadata and URLs) from an API Gateway endpoint. This endpoint is linked to the DynamoDB table, allowing the frontend to query and display the photo information as JSON data.

This serverless architecture ensures scalability, reliability, and cost-effectiveness for the image processing pipeline.

## Deployment

The application is currently hosted in an AWS S3 bucket behind a CloudFront distribution. This architecture provides:

- Global content delivery with low latency
- HTTPS security
- High availability
- Cost-effective hosting for static assets

### Deployment Architecture

1. **Amazon S3**: Stores all static files (HTML, CSS, JavaScript, and assets)
2. **Amazon CloudFront**: Acts as a CDN, caching content at edge locations worldwide
3. **AWS Lambda & API Gateway**: Handle serverless backend operations (as described in the Backend Image Processing Workflow)
