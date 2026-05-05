# Document RAG API Documentation

## Overview

This API provides a GPU-accelerated Pure Retrieval system for document processing and querying. The system uses ChromaDB for vector storage and Sentence Transformers for embeddings, focusing on delivering the most relevant document chunks without AI-generated answers. The GPU runtime is pinned to CUDA device `1`.

**Base URL:** `http://localhost:3300`
**Technology Stack:** FastAPI, ChromaDB, Sentence Transformers, PyTorch GPU

If fewer than 2 CUDA devices are available, the service fails during startup rather than silently switching to GPU 0.

## Authentication

No authentication is required for this API. CORS is enabled for all origins.

## Endpoints

### 1. Upload Documents

Upload and process documents to be indexed in the vector database.

**Endpoint:** `POST /upload`

**Content-Type:** `multipart/form-data`

**Request Body:**
- `files` (required): Multiple files to upload
  - Supported formats: PDF, DOCX, TXT, PNG, JPEG, JPG
- `collection_name` (optional): Name of the collection (default: "default")

**Example Request (Postman):**
```
POST http://localhost:3300/upload
Content-Type: multipart/form-data

Form Data:
- files: [Select multiple files - PDF, DOCX, TXT, PNG, JPEG]
- collection_name: my_documents
```

**Success Response (200):**
```json
{
  "message": "Successfully processed 2 documents",
  "results": [
    {
      "filename": "document1.pdf",
      "status": "success",
      "chunks_added": 15,
      "document_ids": ["uuid1", "uuid2", "..."]
    },
    {
      "filename": "document2.docx",
      "status": "success",
      "chunks_added": 8,
      "document_ids": ["uuid15", "uuid16", "..."]
    }
  ]
}
```

**Error Response (500):**
```json
{
  "detail": "Error processing documents: [error message]"
}
```

### 2. Add Text Content

Add text content directly to the vector database without file upload.

**Endpoint:** `POST /add_text`

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "text": "Your text content here...",
  "collection_name": "optional_collection_name",
  "top_k": 5
}
```

**Example Request (Postman):**
```
POST http://localhost:3300/add_text
Content-Type: application/json

{
  "text": "This is a sample text document that will be processed and stored in the vector database for later querying.",
  "collection_name": "sample_texts",
  "top_k": 5
}
```

**Success Response (200):**
```json
{
  "message": "Successfully added text to collection",
  "collection_name": "sample_texts",
  "chunks_added": 3,
  "document_ids": ["uuid1", "uuid2", "uuid3"],
  "text_preview": "This is a sample text document..."
}
```

### 3. Query Documents

Query the system to retrieve the most relevant document chunks.

**Endpoint:** `POST /query`

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "query": "What is the main topic discussed in the documents?",
  "collection_name": "default",
  "top_k": 5
}
```

**Example Request (Postman):**
```
POST http://localhost:3300/query
Content-Type: application/json

{
  "query": "Explain the key concepts in machine learning",
  "collection_name": "ml_docs",
  "top_k": 5
}
```

**Success Response (200):**
```json
{
  "query": "Explain the key concepts in machine learning",
  "relevant_chunks": [
    {
      "text": "Machine learning algorithms build a model based on training data...",
      "metadata": {
        "source": "ml_guide.pdf",
        "chunk_index": 2,
        "total_chunks": 10
      },
      "similarity_score": 0.85,
      "reranking_score": 0.85,
      "rank": 1
    }
  ],
  "total_chunks_retrieved": 15,
  "top_chunks_returned": 5
}
```

**Error Response (500):**
```json
{
  "query": "Explain the key concepts in machine learning",
  "error": "Error during retrieval: [error message]",
  "relevant_chunks": [],
  "total_chunks_retrieved": 0,
  "top_chunks_returned": 0
}
```

### 4. List Collections

Get a list of all available collections in the vector database.

**Endpoint:** `GET /collections`

**Example Request (Postman):**
```
GET http://localhost:3300/collections
```

**Success Response (200):**
```json
{
  "collections": [
    "default",
    "ml_docs",
    "research_papers",
    "sample_texts"
  ]
}
```

### 5. Delete Collection

Delete a collection and all its documents from the vector database.

**Endpoint:** `DELETE /collections/{collection_name}`

**Example Request (Postman):**
```
DELETE http://localhost:3300/collections/old_collection
```

**Success Response (200):**
```json
{
  "message": "Collection 'old_collection' deleted successfully"
}
```

**Error Response (500):**
```json
{
  "detail": "Error deleting collection: [error message]"
}
```

### 6. Get GPU Information

Get information about the GPU usage and memory.

**Endpoint:** `GET /gpu-info`

**Example Request (Postman):**
```
GET http://localhost:3300/gpu-info
```

**Success Response (200) - GPU Available:**
```json
{
  "device": "cuda:1",
  "gpu_name": "NVIDIA GeForce RTX 3060",
  "total_memory_gb": 12.0,
  "allocated_memory_gb": 2.5,
  "cached_memory_gb": 3.2
}
```

**Success Response (200) - CPU Only:**
```json
{
  "device": "cpu",
  "gpu_available": false
}
```

## Request/Response Models

### QueryRequest
```python
{
  "query": "str",  # The question to ask
  "collection_name": "str (optional)",  # Default: "default"
  "top_k": "int (optional)"  # Number of chunks to retrieve, Default: 5
}
```

### TextInputRequest
```python
{
  "text": "str",  # The text content to add
  "collection_name": "str (optional)",  # Default: "default"
  "top_k": "int (optional)"  # Not used in current implementation
}
```

### QueryResponse
```python
{
  "query": "str",  # Original query
  "relevant_chunks": [
    {
      "text": "str",  # Document chunk text
      "metadata": {
        "source": "str",  # Filename
        "chunk_index": "int",  # Chunk position
        "total_chunks": "int"  # Total chunks in document
      },
      "similarity_score": "float",  # Embedding similarity (0-1)
      "reranking_score": "float",  # Same as similarity score (for consistency)
      "rank": "int"  # Position in results
    }
  ],
  "total_chunks_retrieved": "int",  # Initial retrieval count
  "top_chunks_returned": "int"  # Number of top chunks returned
}
```

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `500`: Internal server error

Error responses include a `detail` field with the error message.

## Usage Examples

### Complete Workflow Example

1. **Upload Documents:**
   ```
   POST /upload
   - Upload PDF/DOCX files
   - Collection: "my_docs"
   ```

2. **Add Text Content:**
   ```
   POST /add_text
   - Text: "Additional context..."
   - Collection: "my_docs"
   ```

3. **Query Documents:**
   ```
   POST /query
   - Query: "What are the main findings?"
   - Collection: "my_docs"
   - top_k: 5
   ```

4. **Check Collections:**
   ```
   GET /collections
   ```

5. **Monitor GPU Usage:**
   ```
   GET /gpu-info
   ```

## Technical Details

- **Document Processing:** Documents are split into 1000-character chunks with 100-character overlap
- **Embeddings:** Uses BAAI/bge-large-en model with GPU acceleration
- **Ranking:** Uses pure similarity-based ranking with cosine similarity
- **Vector Database:** ChromaDB with cosine similarity
- **GPU Support:** Automatic GPU detection and utilization when available
- **Pure Retrieval:** Returns only relevant chunks without AI-generated answers

## Postman Collection

You can import these examples into Postman by creating a new collection and adding the requests with the specified URLs, methods, and body content.

## Starting the Server

To start the server, run:
```bash
cd gpu_rag
./start_rag.bat
```

The server will be available at `http://localhost:3300` with automatic API documentation at `http://localhost:3300/docs` (Swagger UI).
