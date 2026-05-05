# Conversion Services API Endpoints

This document outlines the API endpoints for the PDF, DOCX, and PPTX conversion services, including their expected input JSON bodies and output formats.

## 1. HTML to PDF Conversion

- **Endpoint:** `/api/convert-pdf`
- **Method:** `POST`
- **Description:** Converts HTML content to a PDF file.
- **Input Body (JSON):**
  ```json
  {
    "html": "<p>Your HTML content here</p>"
  }
  ```
- **Output Format:** Binary PDF file

## 2. DOCX Conversion

- **Endpoint:** `/api/convert-docx`
- **Method:** `POST`
- **Description:** Converts structured content into a DOCX file.
- **Input Body (JSON):**
  ```json
  {
    "content": [
      {
        "type": "heading",
        "level": 1,
        "value": "Main Title"
      },
      {
        "type": "paragraph",
        "value": "This is a paragraph of text."
      },
      {
        "type": "list_item",
        "value": "List item one"
      },
      {
        "type": "list_item",
        "value": "List item two"
      }
    ]
  }
  ```
- **Output Format:** Binary DOCX file

## 3. PPTX Conversion

- **Endpoint:** `/api/convert-pptx`
- **Method:** `POST`
- **Description:** Converts structured content into a PPTX (PowerPoint) file.
- **Input Body (JSON):**
  ```json
  {
    "slides": [
      {
        "title": "Slide Title 1",
        "content": [
          {
            "type": "paragraph",
            "value": "This is the first paragraph on slide 1."
          },
          {
            "type": "list_item",
            "value": "Bullet point one"
          },
          {
            "type": "list_item",
            "value": "Bullet point two"
          },
          {
            "type": "image",
            "value": "base64_encoded_image_data",
            "left": 100,
            "top": 100,
            "width": 200,
            "height": 150
          }
        ]
      },
      {
        "title": "Slide Title 2",
        "content": [
          {
            "type": "paragraph",
            "value": "This is content for slide 2."
          }
        ]
      }
    ]
  }
  ```
- **Output Format:** Binary PPTX file