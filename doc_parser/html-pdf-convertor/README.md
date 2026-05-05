# HTML to PDF Converter with Local Storage & Google Drive Upload

A tool that converts HTML content to PDF while preserving the exact appearance as it would look in a browser. It can also upload the generated PDF to Google Drive.

## Features

- Converts HTML content to PDF
- Preserves styling, formatting, and layout
- Supports CSS styling
- Simple API endpoints for conversion
- Local storage with direct download URLs (perfect for n8n integration)
- Google Drive integration for PDF storage
- Web interface for easy use

## Installation

1. Clone this repository
2. Install dependencies:
```
npm install
```

3. Set up Google Drive API credentials:
   - Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
   - Enable the Google Drive API
   - Create OAuth 2.0 credentials (client ID and client secret)
   - Create a `config.env` file based on the `config.env.example` template
   - Fill in your Google API credentials in the `config.env` file

## Usage

### Start the server:
```
npm start
```

### Convert HTML to PDF:
Send a POST request to `http://localhost:3000/convert` with the HTML content in the request body.

Example using curl:
```
curl -X POST -H "Content-Type: application/json" -d '{"html": "<h1>Hello World</h1>"}' http://localhost:3000/convert --output output.pdf
```

### Convert HTML to PDF and store locally (recommended for n8n):
Send a POST request to `http://localhost:3000/api/convert-local` with the HTML content in the request body.

Example using curl:
```
curl -X POST -H "Content-Type: application/json" -d '{"html": "<h1>Hello World</h1>", "fileName": "my-document.pdf"}' http://localhost:3000/api/convert-local
```

The response will include a `downloadUrl` that can be directly used in n8n to download the PDF file.

### Convert HTML to PDF and upload to Google Drive:
Send a POST request to `http://localhost:3000/api/convert-and-upload` with the HTML content in the request body.

Example using curl:
```
curl -X POST -H "Content-Type: application/json" -d '{"html": "<h1>Hello World</h1>", "fileName": "my-document.pdf"}' http://localhost:3000/api/convert-and-upload
```

### Web Interface:
You can also use the web interface by opening `http://localhost:3000` in your browser.

### API Documentation:
Access the API documentation at `http://localhost:3000/api-docs`.

## Testing

To test the API endpoints:
```
node test-api.js
```

## Requirements

- Node.js
- NPM
- Google Drive API credentials 