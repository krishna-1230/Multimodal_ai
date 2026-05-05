const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config({ path: './config.env' });

// Google Drive API setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Set credentials using refresh token
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// Create Drive client
const drive = google.drive({
  version: 'v3',
  auth: oauth2Client
});

/**
 * Upload a file to Google Drive
 * @param {string} filePath - Path to the file to upload
 * @param {string} fileName - Name to give the file in Google Drive
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<object>} - Drive file object
 */
async function uploadFile(filePath, fileName, mimeType) {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: mimeType
      },
      media: {
        mimeType: mimeType,
        body: fs.createReadStream(filePath)
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    throw error;
  }
}

/**
 * Upload PDF buffer directly to Google Drive
 * @param {Buffer} fileBuffer - Buffer containing the file data
 * @param {string} fileName - Name to give the file in Google Drive
 * @returns {Promise<object>} - Drive file object
 */
async function uploadPdfBuffer(fileBuffer, fileName) {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/pdf'
      },
      media: {
        mimeType: 'application/pdf',
        body: fileBuffer
      }
    });

    // Make the file publicly accessible
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    // Get the file with webViewLink
    const file = await drive.files.get({
      fileId: response.data.id,
      fields: 'id, name, webViewLink, webContentLink'
    });

    return file.data;
  } catch (error) {
    console.error('Error uploading buffer to Google Drive:', error);
    throw error;
  }
}

/**
 * Generate a public URL for a file
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<string>} - Public URL
 */
async function getPublicUrl(fileId) {
  try {
    // Make the file publicly accessible
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    // Get the file with webViewLink
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink, webContentLink'
    });

    return {
      viewLink: file.data.webViewLink,
      downloadLink: file.data.webContentLink
    };
  } catch (error) {
    console.error('Error generating public URL:', error);
    throw error;
  }
}

module.exports = {
  uploadFile,
  uploadPdfBuffer,
  getPublicUrl
}; 