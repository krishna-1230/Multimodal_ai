# Document RAG API

A Retrieval-Augmented Generation (RAG) system that allows you to chat with your documents. This system supports multiple file types including PDFs, Word documents, text files, and images. **Now with GPU acceleration support for NVIDIA RTX 3060, pinned to GPU 1 (the second CUDA device)!**

## Features

- Upload and process multiple document types (PDF, DOCX, TXT, PNG, JPEG)
- Extract text from images using OCR
- Store document chunks in a vector database (ChromaDB)
- Query documents using natural language
- Organize documents in collections
- **GPU acceleration for embeddings using NVIDIA RTX 3060 on GPU 1**
- **Real-time GPU monitoring and optimization**
- RESTful API for integration with other systems (like n8n)

## Requirements

- Python 3.8+
- Tesseract OCR (for image processing)
- **NVIDIA GPU with CUDA support (tested with RTX 3060 12GB)**
- **CUDA 11.8 or later**

## Installation

### Option 1: GPU Setup (Recommended for RTX 3060)

1. Clone this repository:
```
git clone <repository-url>
cd <repository-directory>
```

2. **Install GPU dependencies:**
```
# Run the GPU installation script
install_gpu_deps.bat
```

3. **Test GPU setup:**
```
python gpu_optimizer.py
```

### Option 2: CPU Setup

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

## GPU Optimization

The system is optimized for RTX 3060 with 12GB VRAM and targets CUDA device `1`:

- **Automatic GPU detection and configuration for the second CUDA device**
- **Optimized batch size (32) for RTX 3060**
- **Memory management with torch.no_grad()**
- **CUDNN benchmark enabled for performance**
- **Real-time GPU monitoring**

### GPU Features

- **Embedding Generation**: Uses GPU acceleration for faster text embedding generation
- **Memory Management**: Automatic GPU memory optimization and cache management
- **Performance Monitoring**: Real-time GPU memory and performance tracking
- **Batch Processing**: Optimized batch sizes for RTX 3060

## Usage

### Starting the server

```
python app.py
```

The server will start on http://localhost:3300

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
curl -X POST "http://localhost:3300/upload" \
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
curl -X POST "http://localhost:3300/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the main topic of the document?", "collection_name": "my_collection", "top_k": 5}'
```

#### List Collections

```
GET /collections
```

Example using curl:
```
curl "http://localhost:3300/collections"
```

#### Delete Collection

```
DELETE /collections/{collection_name}
```

Example using curl:
```
curl -X DELETE "http://localhost:3300/collections/my_collection"
```

#### **GPU Information (New)**

```
GET /gpu-info
```

Returns GPU status, memory usage, and performance metrics.

Example using curl:
```
curl "http://localhost:3300/gpu-info"
```

## GPU Monitoring and Optimization

### Using the GPU Optimizer

Run the GPU optimizer to configure optimal settings:

```
python gpu_optimizer.py
```

The GPU service is hard-coded to use `cuda:1`. If your machine exposes fewer than 2 CUDA devices, startup and GPU optimization will fail with a clear error instead of silently falling back to GPU 0.

This will:
- Detect GPU 1 and configure optimal settings
- Test GPU memory allocation
- Provide performance optimization tips
- Offer real-time performance monitoring

### Performance Tips for RTX 3060

1. **Batch Size**: Optimal batch size is 32 for RTX 3060
2. **Memory Management**: System automatically uses 80% of available VRAM
3. **Model Loading**: Models are loaded to GPU during initialization
4. **Cache Management**: Automatic GPU cache clearing after operations
5. **Mixed Precision**: Consider using float16 for memory efficiency

## Integration with n8n

You can use the HTTP Request node in n8n to interact with this API:

1. For uploading documents:
   - Use the HTTP Request node with POST method
   - Set the URL to `http://localhost:3300/upload`
   - Use "Form-data Multipart" for the request
   - Add files and collection_name as fields

2. For querying documents:
   - Use the HTTP Request node with POST method
   - Set the URL to `http://localhost:3300/query`
   - Use "JSON" for the request
   - Set the JSON body with query, collection_name, and top_k

3. **For GPU monitoring:**
   - Use the HTTP Request node with GET method
   - Set the URL to `http://localhost:3300/gpu-info`

## Technical Details

- Document text extraction: Uses PyPDF, python-docx, and pytesseract
- Text chunking: Uses LangChain's RecursiveCharacterTextSplitter
- **Vector embeddings: Uses BAAI/bge-large-en model via sentence-transformers with GPU acceleration**
- Vector database: ChromaDB
- LLM: Google's Gemini 2.5 Flash (1 million token context length)
- API: FastAPI
- **GPU Framework: PyTorch with CUDA 11.8 support**
- **GPU Optimization: CUDNN benchmark, memory management, batch optimization** 