import os
import json
from document_processor import process_document
from rag_engine import RAGEngine

# Initialize RAG engine
rag_engine = RAGEngine()

# Path to workflows folder
workflows_dir = os.path.join(os.path.dirname(__file__), 'workflows')

# Process each JSON file in workflows folder
for filename in os.listdir(workflows_dir):
    if filename.endswith('.json'):
        file_path = os.path.join(workflows_dir, filename)
        
        # Read JSON file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Process as text document
        document_chunks = process_document(
            content.encode('utf-8'),
            filename,
            'application/json'
        )
        
        # Add to 'n8n' collection
        rag_engine.add_documents(document_chunks, 'n8n')
        
        print(f"Processed {filename}")

print("All workflow files added to 'n8n' collection")