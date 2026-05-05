# Converters API

This document describes the available endpoints for the DOCX and PPTX converter services.

## DOCX Converter

- **Endpoint**: `/convert-docx`
- **Method**: POST

### Payload options

Two input styles are supported:

1) HTML input

```json
{
  "html_content": "<h1>Hello</h1><p>Paragraph</p>",
  "return_file": false,                // optional - when true, returns file directly
  "default_style": {                  // optional
    "font_name": "Times New Roman",
    "font_size": 12,
    "bold": false,
    "italic": false,
    "color": "#333333"
  }
}
```

2) Structured content

```json
{
  "content": [
    {"type": "heading", "level": 1, "text": "Title", "style": {"font_size": 24}},
    {"type": "paragraph", "text": "A paragraph", "style": {"font_name": "Arial", "font_size": 11}},
    {"type": "list", "items": ["item1","item2"]},
    {"type": "table", "data": [["c1","c2"],["c3","c4"]]},
    {"type": "image", "path": "./img.png", "width": 4}
  ],
  "return_file": true
}
```

### Response

- On success (when `return_file` is false):

```json
{
  "success": true,
  "file": {
    "name": "<uuid>.docx",
    "path": "/absolute/path/to/output/<uuid>.docx",
    "downloadUrl": "http://<host>:<port>/output/<uuid>.docx"
  }
}
```

- When `return_file` is true, the endpoint responds with the DOCX binary using `Content-Disposition: attachment`.


## PPTX Converter

- **Endpoint**: `/convert-pptx`
- **Method**: POST

### Payload example

```json
{
  "slide_size": "16:9", // optional: '16:9', '4:3' or {"width": 10, "height": 7.5}
  "slides": [
    {
      "layout_index": 1,
      "title": "Slide title",
      "title_style": {"font_size": 36, "color": "#ffffff"},
      "background": {"color": "#2b5797"},
      "content": [
        {"type": "paragraph", "text": "Intro text", "style": {"font_size": 18, "color": "#ffffff"}},
        {"type": "list", "items": ["a","b"]},
        {"type": "image", "path": "https://.../img.png", "left": 1, "top": 1, "width": 6, "height": 4}
      ]
    }
  ]
}
```

### Response

```json
{
  "success": true,
  "file": {
    "name": "<uuid>.pptx",
    "path": "/absolute/path/to/output/<uuid>.pptx",
    "downloadUrl": "http://<host>:<port>/output/<uuid>.pptx"
  }
}
```

The PPTX converter supports:
- custom slide sizes (`slide_size`)
- slide background color
- text styles (font name, size, bold, color)
- images from local path or remote URLs


