import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import json
from dotenv import load_dotenv

# Import our custom modules
from document_processor import process_document
from rag_engine import RAGEngine

# Load environment variables
load_dotenv()

app = FastAPI(title="Document RAG API", description="API for chatting with documents using RAG")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG engine
rag_engine = RAGEngine()

class QueryRequest(BaseModel):
    query: str
    collection_name: Optional[str] = "default"
    top_k: Optional[int] = 5

class TextInputRequest(BaseModel):
    text: str
    collection_name: Optional[str] = "default"
    top_k: Optional[int] = 5

@app.post("/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    collection_name: str = Form("default")
):
    """
    Upload documents to be processed and indexed in the vector database.
    Supports PDF, DOCX, TXT, PNG, and JPEG files.
    """
    try:
        results = []
        for file in files:
            # Process each document
            content_type = file.content_type
            file_content = await file.read()

            # Process the document based on its type
            document_chunks = process_document(file_content, file.filename, content_type)

            # Add the document chunks to the vector database
            doc_ids = rag_engine.add_documents(document_chunks, collection_name)

            results.append({
                "filename": file.filename,
                "status": "success",
                "chunks_added": len(doc_ids),
                "document_ids": doc_ids
            })

        return JSONResponse(
            content={
                "message": f"Successfully processed {len(files)} documents",
                "results": results
            },
            status_code=200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing documents: {str(e)}")

@app.post("/add_text")
async def add_text(request: TextInputRequest):
    """
    Add text content directly to the vector database without file upload.
    Useful for adding text snippets, articles, or any text content.
    """
    try:
        # Create document chunks from the input text
        from document_processor import create_text_chunks

        # Process the text into chunks
        document_chunks = create_text_chunks(request.text, "direct_text_input")

        # Add the document chunks to the vector database
        doc_ids = rag_engine.add_documents(document_chunks, request.collection_name)

        return JSONResponse(
            content={
                "message": "Successfully added text to collection",
                "collection_name": request.collection_name,
                "chunks_added": len(doc_ids),
                "document_ids": doc_ids,
                "text_preview": request.text[:200] + "..." if len(request.text) > 200 else request.text
            },
            status_code=200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding text: {str(e)}")

@app.post("/query")
async def query_documents(request: QueryRequest):
    """
    Query the RAG system with a question about the documents.
    Returns an answer generated based on the relevant document chunks.
    """
    try:
        # Get answer from the RAG engine
        response = rag_engine.query(
            request.query, 
            collection_name=request.collection_name,
            top_k=request.top_k
        )
        
        return JSONResponse(
            content=response,
            status_code=200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying documents: {str(e)}")

@app.get("/collections")
async def list_collections():
    """
    List all available collections in the vector database.
    """
    try:
        collections = rag_engine.list_collections()
        return JSONResponse(
            content={"collections": collections},
            status_code=200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing collections: {str(e)}")

@app.delete("/collections/{collection_name}")
async def delete_collection(collection_name: str):
    """
    Delete a collection from the vector database.
    """
    try:
        rag_engine.delete_collection(collection_name)
        return JSONResponse(
            content={"message": f"Collection '{collection_name}' deleted successfully"},
            status_code=200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting collection: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=3300, reload=True) 