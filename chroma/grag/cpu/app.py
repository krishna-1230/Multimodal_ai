from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer, CrossEncoder
import chromadb
from chromadb.utils import embedding_functions
import networkx as nx
import pickle
import os
import sys
import time
# Add parent directory to path to import common module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import config

# Initialize Flask app
app = Flask(__name__)

# Chroma persistence directory for CPU service
PERSIST_DIR = os.path.join(os.path.dirname(__file__), "chroma_db_cpu")
client = chromadb.PersistentClient(path=PERSIST_DIR)

# Use a CPU model from sentence-transformers (fast small model)
EMBED_MODEL_NAME = os.environ.get('CPU_EMBED_MODEL', 'all-MiniLM-L6-v2')
embed_model = SentenceTransformer(EMBED_MODEL_NAME)

# Optional CPU reranker (cross-encoder). Enable with env: CPU_USE_RERANK=true
CPU_USE_RERANK = os.environ.get('CPU_USE_RERANK', 'false').lower() == 'true'
cross_encoder = None
if CPU_USE_RERANK:
    try:
        cross_encoder = CrossEncoder(os.environ.get('CPU_RERANK_MODEL', 'cross-encoder/ms-marco-MiniLM-L-6-v2'))
    except Exception:
        cross_encoder = None

# In-memory recent-node cache to avoid scanning full graph on each query
recent_node_cache = {}

# Graph read/write helpers using pickle for compatibility
def read_graph(path):
    try:
        with open(path, 'rb') as fh:
            return pickle.load(fh)
    except Exception:
        return None

def write_graph(G, path):
    try:
        with open(path, 'wb') as fh:
            pickle.dump(G, fh)
    except Exception:
        # fallback to networkx writer if available
        try:
            nx.write_gpickle(G, path)
        except Exception as e:
            raise e

# Chroma embedding function wrapper
def embed_texts(texts):
    # batch encode using configured CPU batch size
    batch_size = config.CPU_BATCH_SIZE
    embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        emb = embed_model.encode(batch, convert_to_numpy=True)
        embeddings.extend(emb.tolist())
    return embeddings


# Robustly parse chroma query results across versions
def parse_query_results(results):
    # results may contain keys in different shapes depending on chromadb version
    # Try common shapes and fall back to empty lists
    try:
        if isinstance(results, dict):
            # shape: {'documents': [[...]], 'ids': [[...]], 'metadatas': [[...]]}
            if 'documents' in results and 'ids' in results and 'metadatas' in results:
                return results['documents'][0], results['ids'][0], results['metadatas'][0]
            # shape: {'data': [{'documents': [...], 'ids': [...], 'metadatas': [...]}]}
            if 'data' in results and isinstance(results['data'], list) and len(results['data']) > 0:
                first = results['data'][0]
                return first.get('documents', []), first.get('ids', []), first.get('metadatas', [])
        # unknown shape
    except Exception:
        pass
    return [], [], []

# Create or get collection per user
def get_collection_for_user(user_id):
    col_name = f"user_{user_id}"
    try:
        return client.get_collection(col_name)
    except Exception:
        # create collection without passing a custom embedding function
        # we compute and pass embeddings explicitly when adding documents
        return client.create_collection(col_name)

# Provide embedding function for chroma
def get_embedding_function():
    # Use custom embedding function to avoid compatibility issues
    class CustomEmbeddingFunction:
        def __call__(self, texts):
            return embed_texts(texts)
    return CustomEmbeddingFunction()

# Add chat messages to collection and graph
@app.route('/add_chat', methods=['POST'])
def add_chat():
    try:
        data = request.json
        if not data or 'user_id' not in data or 'messages' not in data:
            return jsonify({'status': 'error', 'message': 'user_id and messages required'}), 400
        
        user_id = data['user_id']
        messages = data['messages']  # list of {"id":..., "text":..., "meta":{}}

        collection = get_collection_for_user(user_id)

        # store documents in chroma
        ids = [m['id'] for m in messages]
        texts = [m['text'] for m in messages]
        metadatas = [m.get('meta', {}) for m in messages]

        embeddings = embed_texts(texts)
        collection.add(ids=ids, documents=texts, metadatas=metadatas, embeddings=embeddings)

        # build/update graph
        graph_path = os.path.join(os.path.dirname(__file__), f"graph_user_{user_id}.gpickle")
        if os.path.exists(graph_path):
            G = read_graph(graph_path) or nx.DiGraph()
        else:
            G = nx.DiGraph()

        for m in messages:
            G.add_node(m['id'], text=m['text'], **m.get('meta', {}))
        for i in range(len(messages) - 1):
            G.add_edge(messages[i]['id'], messages[i+1]['id'])

        write_graph(G, graph_path)

        # update recent node cache for fast recency-based scoring
        if len(ids) > 0:
            recent_node_cache[user_id] = ids[-1]

        return jsonify({'status': 'ok', 'added': len(messages)})
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

# Add documents to collection and graph
@app.route('/add_docs', methods=['POST'])
def add_docs():
    try:
        data = request.json
        user_id = data['user_id']
        documents = data['documents']  # list of {"id":..., "text":..., "meta":{}, "title": "optional"}
        
        collection = get_collection_for_user(user_id)
        
        # Process documents
        ids = [doc['id'] for doc in documents]
        texts = [doc['text'] for doc in documents]
        metadatas = []
        
        for doc in documents:
            meta = doc.get('meta', {})
            meta['type'] = 'document'
            if 'title' in doc:
                meta['title'] = doc['title']
            metadatas.append(meta)
        
        embeddings = embed_texts(texts)
        collection.add(ids=ids, documents=texts, metadatas=metadatas, embeddings=embeddings)
        
        # Add to graph as isolated nodes (documents don't have chat sequence)
        graph_path = os.path.join(os.path.dirname(__file__), f"graph_user_{user_id}.gpickle")
        if os.path.exists(graph_path):
            G = read_graph(graph_path) or nx.DiGraph()
        else:
            G = nx.DiGraph()
        
        for doc in documents:
            node_attrs = doc.get('meta', {})
            node_attrs['text'] = doc['text']
            node_attrs['type'] = 'document'
            if 'title' in doc:
                node_attrs['title'] = doc['title']
            G.add_node(doc['id'], **node_attrs)
        
        write_graph(G, graph_path)
        
        return jsonify({'status': 'ok', 'added': len(documents)})
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

# Retrieve RAG response for a query
@app.route('/query', methods=['POST'])
def query():
    try:
        data = request.json
        if not data or 'user_id' not in data or 'query' not in data:
            return jsonify({'status': 'error', 'message': 'user_id and query required'}), 400
        
        user_id = data['user_id']
        query_text = data['query']
        top_k = data.get('top_k', 5)

        collection = get_collection_for_user(user_id)

        # Step 1: dense seed using a larger N for candidate generation
        nseed = config.CPU_NSEED
        q_emb = embed_texts([query_text])[0]
        # Request canonical fields; some chroma versions do not accept 'ids' in include
        try:
            results = collection.query(query_embeddings=[q_emb], n_results=nseed, include=['documents', 'metadatas'])
        except Exception:
            # fallback to older/newer chroma shapes
            results = collection.query(query_embeddings=[q_emb], n_results=nseed)

        # Normalize results across chroma versions
        docs, ids, metas = parse_query_results(results)

        # Step 2: expand via graph neighbors (1 hop by default)
        candidates = {}
        for idx, doc in enumerate(docs):
            doc_id = ids[idx]
            candidates[doc_id] = {'id': doc_id, 'text': doc, 'meta': metas[idx]}

        graph_path = os.path.join(os.path.dirname(__file__), f"graph_user_{user_id}.gpickle")
        if os.path.exists(graph_path):
            G = read_graph(graph_path) or nx.DiGraph()
            hops = config.EXPAND_HOPS
            for base_id in list(candidates.keys()):
                if base_id in G:
                    # add neighbors up to configured hops (breadth-first)
                    fringe = {base_id}
                    for _ in range(hops):
                        new_fringe = set()
                        for n in fringe:
                            for nbr in G.neighbors(n):
                                if nbr not in candidates:
                                    node_data = G.nodes[nbr]
                                    candidates[nbr] = {'id': nbr, 'text': node_data.get('text', ''), 'meta': node_data}
                                new_fringe.add(nbr)
                        fringe = new_fringe

        # Step 3: optional CPU cross-encoder rerank for higher accuracy (slower)
        candidate_list = list(candidates.values())

        if CPU_USE_RERANK and cross_encoder is not None and len(candidate_list) > 0:
            pairs = [(query_text, c['text'][:1000]) for c in candidate_list]
            try:
                scores = cross_encoder.predict(pairs)
            except Exception:
                scores = [0.0] * len(candidate_list)
            for i, c in enumerate(candidate_list):
                c['score'] = float(scores[i])
            candidate_list.sort(key=lambda x: x.get('score', 0.0), reverse=True)
        else:
            # fallback: sort by presence in recent cache and then by original chroma order
            recent = recent_node_cache.get(user_id)
            for i, c in enumerate(candidate_list):
                # give boost if same as recent node
                c['score'] = 1.0 if c['id'] == recent else 0.0
                c['orig_rank'] = i
            candidate_list.sort(key=lambda x: ( -x['score'], x['orig_rank']))

        # return top_k
        top = candidate_list[:top_k]
        return jsonify({'query': query_text, 'results': top})
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

# Health check endpoint
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'cpu_rag',
        'model': EMBED_MODEL_NAME,
        'device': 'cpu'
    })

# Get user statistics
@app.route('/user_stats', methods=['GET'])
def user_stats():
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'status': 'error', 'message': 'user_id required'}), 400
        
        collection = get_collection_for_user(user_id)
        
        # Get collection count
        try:
            count_result = collection.count()
            doc_count = count_result
        except:
            doc_count = 0
        
        # Get graph stats
        graph_path = os.path.join(os.path.dirname(__file__), f"graph_user_{user_id}.gpickle")
        graph_stats = {'nodes': 0, 'edges': 0}
        if os.path.exists(graph_path):
            try:
                G = read_graph(graph_path) or nx.DiGraph()
                graph_stats = {'nodes': G.number_of_nodes(), 'edges': G.number_of_edges()}
            except:
                pass
        
        return jsonify({
            'user_id': user_id,
            'document_count': doc_count,
            'graph_stats': graph_stats,
            'recent_node': recent_node_cache.get(user_id)
        })
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

# Clear user data
@app.route('/clear_user', methods=['DELETE'])
def clear_user():
    try:
        data = request.json
        user_id = data['user_id']
        
        # Delete collection
        try:
            client.delete_collection(f"user_{user_id}")
        except:
            pass
        
        # Delete graph file
        graph_path = os.path.join(os.path.dirname(__file__), f"graph_user_{user_id}.gpickle")
        if os.path.exists(graph_path):
            os.remove(graph_path)
        
        # Clear from cache
        if user_id in recent_node_cache:
            del recent_node_cache[user_id]
        
        return jsonify({'status': 'ok', 'message': f'User {user_id} data cleared'})
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

# List all users
@app.route('/list_users', methods=['GET'])
def list_users():
    try:
        collections = client.list_collections()
        users = []
        for col in collections:
            if col.name.startswith('user_'):
                user_id = col.name[5:]  # Remove 'user_' prefix
                users.append(user_id)
        
        return jsonify({'users': users, 'count': len(users)})
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
