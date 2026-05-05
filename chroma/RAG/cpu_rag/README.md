# Document RAG API

A Retrieval-Augmented Generation (RAG) system that allows you to chat with your documents. This system supports multiple file types including PDFs, Word documents, text files, and images.

## Features

- Upload and process multiple document types (PDF, DOCX, TXT, PNG, JPEG)
- Extract text from images using OCR
- Store document chunks in a vector database (ChromaDB)
- Query documents using natural language
- Organize documents in collections
- RESTful API for integration with other systems (like n8n)

## Requirements

- Python 3.8+
- Tesseract OCR (for image processing)

## Installation

1. Clone this repository:
```
git clone <repository-url>
cd <repository-directory>
```

2. Install dependencies:
```
pip install -r requirements.txt
```

3. Install Tesseract OCR:
   - Windows: Download and install from https://github.com/UB-Mannheim/tesseract/wiki
   - macOS: `brew install tesseract`
   - Ubuntu: `sudo apt install tesseract-ocr`

4. Create a `.env` file with your Google API key:
```
GOOGLE_API_KEY=your_google_api_key_here
CHROMA_PERSIST_DIRECTORY=./chroma_db
```

## Usage

### Starting the server

```
python app.py
```

The server will start on http://localhost:8000

### API Endpoints

#### Upload Documents

```
POST /upload
```

Parameters:
- `files`: List of files to upload (multipart/form-data)
- `collection_name`: Name of the collection to add documents to (default: "default")

Example using curl:
```
curl -X POST "http://localhost:8000/upload" \
  -F "files=@document1.pdf" \
  -F "files=@document2.docx" \
  -F "collection_name=my_collection"
```

#### Query Documents

```
POST /query
```

Request body:
```json
{
  "query": "What is the main topic of the document?",
  "collection_name": "my_collection",
  "top_k": 5
}
```

Parameters:
- `query`: The question to ask about the documents
- `collection_name`: Name of the collection to query (default: "default")
- `top_k`: Number of most relevant chunks to retrieve (default: 5)

Example using curl:
```
curl -X POST "http://localhost:8000/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the main topic of the document?", "collection_name": "my_collection", "top_k": 5}'
```

#### List Collections

```
GET /collections
```

Example using curl:
```
curl "http://localhost:8000/collections"
```

#### Delete Collection

```
DELETE /collections/{collection_name}
```

Example using curl:
```
curl -X DELETE "http://localhost:8000/collections/my_collection"
```

## Integration with n8n

You can use the HTTP Request node in n8n to interact with this API:

1. For uploading documents:
   - Use the HTTP Request node with POST method
   - Set the URL to `http://localhost:8000/upload`
   - Use "Form-data Multipart" for the request
   - Add files and collection_name as fields

2. For querying documents:
   - Use the HTTP Request node with POST method
   - Set the URL to `http://localhost:8000/query`
   - Use "JSON" for the request
   - Set the JSON body with query, collection_name, and top_k

## Technical Details

- Document text extraction: Uses PyPDF, python-docx, and pytesseract
- Text chunking: Uses LangChain's RecursiveCharacterTextSplitter
- Vector embeddings: Uses BAAI/bge-large-en model via sentence-transformers
- Vector database: ChromaDB
- LLM: Google's Gemini 2.5 Flash (1 million token context length)
- API: FastAPI 