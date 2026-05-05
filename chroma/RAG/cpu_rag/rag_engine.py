import os
import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any, Optional
# No generative AI needed for pure RAG
from sentence_transformers import SentenceTransformer, CrossEncoder
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# No API key needed for pure RAG retrieval

class RAGEngine:
    def __init__(self):
        # Initialize ChromaDB client
        self.persist_directory = os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_db")
        os.makedirs(self.persist_directory, exist_ok=True)

        self.client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=Settings(allow_reset=True)
        )

        # Initialize the embedding model (BAAI/bge-large-en)
        self.embedding_model = SentenceTransformer("BAAI/bge-large-en")

        # Initialize the reranking model (cross-encoder for better relevance)
        self.reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

        # No LLM needed for pure RAG
    
    def _get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts."""
        return self.embedding_model.encode(texts).tolist()

    def _rerank_documents(self, query: str, documents: List[str], top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Rerank documents based on relevance to the query using cross-encoder.

        Args:
            query: The search query
            documents: List of document texts to rerank
            top_k: Number of top documents to return

        Returns:
            List of reranked documents with scores
        """
        if not documents:
            return []

        # Create query-document pairs for cross-encoder
        query_doc_pairs = [[query, doc] for doc in documents]

        # Get relevance scores from cross-encoder
        scores = self.reranker.predict(query_doc_pairs)

        # Create list of documents with scores
        scored_docs = [{"text": doc, "score": float(score)} for doc, score in zip(documents, scores)]

        # Sort by score in descending order and return top_k
        scored_docs.sort(key=lambda x: x["score"], reverse=True)
        return scored_docs[:top_k]
    
    def _get_or_create_collection(self, collection_name: str):
        """Get or create a ChromaDB collection."""
        try:
            collection = self.client.get_collection(name=collection_name)
        except:
            collection = self.client.create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        return collection
    
    def add_documents(self, documents: List[Dict[str, Any]], collection_name: str = "default") -> List[str]:
        """
        Add documents to the vector database.
        
        Args:
            documents: List of document chunks with text and metadata
            collection_name: Name of the collection to add documents to
            
        Returns:
            List of document IDs
        """
        collection = self._get_or_create_collection(collection_name)
        
        # Extract document IDs, texts, and metadata
        ids = [doc["id"] for doc in documents]
        texts = [doc["text"] for doc in documents]
        metadatas = [doc["metadata"] for doc in documents]
        
        # Generate embeddings
        embeddings = self._get_embeddings(texts)
        
        # Add documents to the collection
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )
        
        return ids
    
    def query(self, query_text: str, collection_name: str = "default", top_k: int = 5) -> Dict[str, Any]:
        """
        Query the RAG system with a question.

        Args:
            query_text: The question to ask
            collection_name: Name of the collection to query
            top_k: Number of most relevant chunks to retrieve

        Returns:
            Dictionary with answer and relevant chunks
        """
        try:
            collection = self._get_or_create_collection(collection_name)

            # Generate embedding for the query
            query_embedding = self._get_embeddings([query_text])[0]

            # First, retrieve more documents than needed for reranking (retrieve 3x more)
            initial_retrieve_count = min(top_k * 3, 50)  # Cap at 50 to avoid too many

            # Query the collection
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=initial_retrieve_count,
                include=["documents", "metadatas", "distances"]
            )

            # Extract documents for reranking
            if not results["documents"] or len(results["documents"]) == 0:
                return {
                    "query": query_text,
                    "relevant_chunks": [],
                    "total_chunks_retrieved": 0,
                    "top_chunks_returned": 0
                }

            documents = results["documents"][0]
            metadatas = results["metadatas"][0]
            distances = results["distances"][0]

            # COMMENTED OUT: Reranking functionality
            # reranked_docs = self._rerank_documents(query_text, documents, top_k)

            # Use original similarity-based ranking but prefer substantive chunks
            scored_docs = []
            for i, (doc, dist) in enumerate(zip(documents, distances)):
                similarity_score = 1 - dist
                # prefer longer chunks over short titles/headings
                length = len(doc.strip())
                length_factor = min(length / 400.0, 1.0)  # scales up to 1.0 for chunks >=400 chars
                # adjusted score boosts longer chunks (weights: 40% similarity, 60% length)
                adjusted_score = similarity_score * (0.4 + 0.6 * length_factor)
                scored_docs.append({
                    "text": doc,
                    "score": adjusted_score,
                    "similarity_score": similarity_score,
                    "length": length,
                    "index": i
                })

            # Sort by adjusted score and pick top_k
            scored_docs.sort(key=lambda x: x["score"], reverse=True)
            top_docs = scored_docs[:top_k]

            # Build context and relevant chunks from similarity-based results
            relevant_chunks = []
            context_text = ""

            for i, doc_info in enumerate(top_docs):
                # Find the original metadata for this document
                doc_text = doc_info["text"]
                doc_index = doc_info["index"]

                metadata = metadatas[doc_index]
                distance = distances[doc_index]

                # Add to context text
                context_text += f"\nDocument: {metadata['source']}, Chunk {metadata['chunk_index'] + 1}/{metadata['total_chunks']}\n"
                context_text += f"{doc_text}\n"

                # Add to relevant chunks with similarity scores only
                relevant_chunks.append({
                    "text": doc_text,
                    "metadata": metadata,
                    "similarity_score": 1 - distance,  # Original embedding similarity
                    "reranking_score": doc_info["score"],  # Using similarity score as reranking score for consistency
                    "rank": i + 1
                })

            # Return pure RAG results without AI-generated answer
            return {
                "query": query_text,
                "relevant_chunks": relevant_chunks,
                "total_chunks_retrieved": len(documents),
                "top_chunks_returned": len(top_docs)
            }

        except Exception as e:
            return {
                "query": query_text,
                "error": f"Error during retrieval: {str(e)}",
                "relevant_chunks": [],
                "total_chunks_retrieved": 0,
                "top_chunks_returned": 0
            }
    
    def list_collections(self) -> List[str]:
        """List all available collections in the vector database."""
        collections = self.client.list_collections()
        return [collection.name for collection in collections]
    
    def delete_collection(self, collection_name: str):
        """Delete a collection from the vector database."""
        self.client.delete_collection(collection_name) 
        