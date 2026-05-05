from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer, CrossEncoder
import chromadb
from chromadb.utils import embedding_functions
import networkx as nx
import pickle
import sqlite3
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
import torch
import numpy as np
try:
    import hnswlib
    HNSW_AVAILABLE = True
except Exception:
    hnswlib = None
    HNSW_AVAILABLE = False
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
    PROM_AVAILABLE = True
except Exception:
    PROM_AVAILABLE = False

# Basic metrics (if prometheus_client available)
if PROM_AVAILABLE:
    QUERY_COUNTER = Counter('gpu_rag_queries_total', 'Total queries received')
    QUERY_LATENCY = Histogram('gpu_rag_query_latency_seconds', 'Query latency seconds')
    ADD_COUNTER = Counter('gpu_rag_adds_total', 'Total documents/messages added')
else:
    QUERY_COUNTER = None
    QUERY_LATENCY = None
    ADD_COUNTER = None

# Add parent directory to path to import common module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import config

# Initialize Flask app
app = Flask(__name__)

# Chroma persistence directory for GPU service
PERSIST_DIR = os.path.join(os.path.dirname(__file__), "chroma_db_gpu")
client = chromadb.PersistentClient(path=PERSIST_DIR)

# Use a known public model by default for stable loading
EMBED_MODEL_NAME = os.environ.get('GPU_EMBED_MODEL', 'sentence-transformers/all-mpnet-base-v2')

# Determine device
GPU_DEVICE_INDEX = 1
USE_CUDA = torch.cuda.is_available()
if USE_CUDA:
    if torch.cuda.device_count() <= GPU_DEVICE_INDEX:
        raise RuntimeError(
            f"GPU {GPU_DEVICE_INDEX} requested, but only {torch.cuda.device_count()} CUDA device(s) are available."
        )
    torch.cuda.set_device(GPU_DEVICE_INDEX)
    DEVICE = f'cuda:{GPU_DEVICE_INDEX}'
else:
    DEVICE = 'cpu'

# Performance tuning via environment/config
# Maximum number of seed results to retrieve from ANN before expansion
GPU_NSEED = int(os.environ.get('GPU_NSEED', str( config.GPU_NSEED if hasattr(config, 'GPU_NSEED') else 50 )))
# Maximum number of candidates to send to cross-encoder reranker
GPU_RERANK_MAX_CANDIDATES = int(os.environ.get('GPU_RERANK_MAX_CANDIDATES', '50'))
# Maximum nodes to include during graph expansion to avoid explosion
GRAPH_EXPAND_MAX_NODES = int(os.environ.get('GRAPH_EXPAND_MAX_NODES', '200'))
# Embedding storage dtype: 'float32' or 'float16'
EMBED_DTYPE = os.environ.get('EMBED_DTYPE', 'float32')
# HNSW index storage
HNSW_DIR = os.path.join(os.path.dirname(__file__), 'hnsw_indexes')
os.makedirs(HNSW_DIR, exist_ok=True)
# In-process cache for loaded HNSW indexes and mappings
hnsw_indexes_cache = {}
redis_client = None

def get_model():
    # Try loading the requested model; if it fails, fall back to a safe default
    try:
        return SentenceTransformer(EMBED_MODEL_NAME, device=DEVICE)
    except Exception as e:
        # Attempt fallback model from env or default
        fallback = os.environ.get('FALLBACK_EMBED_MODEL', 'all-mpnet-base-v2')
        try:
            print(f"Failed to load embed model '{EMBED_MODEL_NAME}': {e}. Falling back to '{fallback}'")
            return SentenceTransformer(fallback, device=DEVICE)
        except Exception as e2:
            # Last resort: try a very small public MiniLM
            final = 'sentence-transformers/all-MiniLM-L6-v2'
            print(f"Fallback load failed: {e2}. Trying final fallback '{final}'")
            return SentenceTransformer(final, device=DEVICE)

embed_model = get_model()
# Model warm-up to reduce first-request latency
try:
    _ = embed_model.encode(['warmup'], convert_to_numpy=True)
except Exception:
    pass

# Optional GPU reranker
GPU_USE_RERANK = os.environ.get('GPU_USE_RERANK', 'true').lower() == 'true'
cross_encoder = None
if GPU_USE_RERANK:
    try:
        cross_encoder = CrossEncoder(os.environ.get('GPU_RERANK_MODEL', 'cross-encoder/ms-marco-MiniLM-L-6-v2'), device=DEVICE)
    except Exception:
        cross_encoder = None

# In-memory recent-node cache
recent_node_cache = {}

# Graph read/write helpers using pickle for compatibility
DB_PATH = os.path.join(os.path.dirname(__file__), 'graph_db.sqlite')
# Ensure DB & tables exist
_db_lock = None
def _get_db_lock():
    global _db_lock
    import threading
    if _db_lock is None:
        _db_lock = threading.Lock()
    return _db_lock

def _init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS nodes (
        user_id TEXT,
        node_id TEXT,
        text TEXT,
        meta TEXT,
        PRIMARY KEY(user_id, node_id)
    )''')
    cur.execute('''CREATE TABLE IF NOT EXISTS edges (
        user_id TEXT,
        src TEXT,
        dst TEXT
    )''')
    conn.commit()
    conn.close()

_init_db()

def _user_from_path(path):
    # expects path like .../graph_user_{user_id}.gpickle
    base = os.path.basename(path)
    if base.startswith('graph_user_'):
        uid = base[len('graph_user_'):]
        uid = uid.replace('.gpickle', '').replace('.pickle', '')
        return uid
    return None

def _parse_iso_ts(ts_str):
    if not ts_str:
        return None
    try:
        if isinstance(ts_str, (int, float)):
            return datetime.fromtimestamp(float(ts_str), tz=timezone.utc)
        s = str(ts_str)
        if s.endswith('Z'):
            s = s[:-1]
            dt = datetime.fromisoformat(s)
            return dt.replace(tzinfo=timezone.utc)
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None

def _get_node_ids_in_timerange(user_id, since_dt=None, until_dt=None):
    if since_dt is None and until_dt is None:
        return None
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute('SELECT node_id, meta FROM nodes WHERE user_id=?', (user_id,))
        rows = cur.fetchall()
        conn.close()
        allowed = set()
        for node_id, meta in rows:
            try:
                meta_obj = json.loads(meta) if meta else {}
            except Exception:
                meta_obj = {}
            ts = meta_obj.get('timestamp')
            ts_dt = _parse_iso_ts(ts)
            if ts_dt is None:
                continue
            if since_dt and ts_dt < since_dt:
                continue
            if until_dt and ts_dt > until_dt:
                continue
            allowed.add(node_id)
        return allowed
    except Exception:
        return None

def read_graph(path):
    try:
        user_id = _user_from_path(path)
        if not user_id:
            return None
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        G = nx.DiGraph()
        cur.execute('SELECT node_id, text, meta FROM nodes WHERE user_id=?', (user_id,))
        rows = cur.fetchall()
        for node_id, text, meta in rows:
            try:
                meta_obj = json.loads(meta) if meta else {}
            except Exception:
                meta_obj = {}
            attrs = meta_obj if isinstance(meta_obj, dict) else {}
            attrs['text'] = text or attrs.get('text', '')
            G.add_node(node_id, **attrs)
        cur.execute('SELECT src, dst FROM edges WHERE user_id=?', (user_id,))
        rows = cur.fetchall()
        for src, dst in rows:
            if src in G and dst in G:
                G.add_edge(src, dst)
        conn.close()
        return G
    except Exception:
        return None

def write_graph(G, path):
    try:
        user_id = _user_from_path(path)
        if not user_id:
            # fallback to pickle write
            with open(path, 'wb') as fh:
                pickle.dump(G, fh)
            return
        lock = _get_db_lock()
        with lock:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            # upsert nodes
            for n, data in G.nodes(data=True):
                text = data.get('text', '')
                meta = {k: v for k, v in data.items() if k != 'text'}
                meta_json = json.dumps(meta)
                cur.execute('REPLACE INTO nodes(user_id, node_id, text, meta) VALUES(?,?,?,?)', (user_id, n, text, meta_json))
            # replace edges for this user: delete and reinsert
            cur.execute('DELETE FROM edges WHERE user_id=?', (user_id,))
            for src, dst in G.edges():
                cur.execute('INSERT INTO edges(user_id, src, dst) VALUES(?,?,?)', (user_id, src, dst))
            conn.commit()
            conn.close()
    except Exception as e:
        # fallback: try gpickle
        try:
            nx.write_gpickle(G, path)
        except Exception:
            raise e

# Chroma embedding function wrapper with batching
def embed_texts(texts):
    batch_size = config.GPU_BATCH_SIZE
    embeddings = []
    # optional CPU parallelism for multiple batches
    EMBED_PARALLELISM = int(os.environ.get('EMBED_PARALLELISM', '1'))
    batches = [texts[i:i+batch_size] for i in range(0, len(texts), batch_size)]
    if USE_CUDA or EMBED_PARALLELISM <= 1:
        for batch in batches:
            if USE_CUDA:
                with torch.cuda.amp.autocast():
                    emb = embed_model.encode(batch, convert_to_numpy=True)
            else:
                emb = embed_model.encode(batch, convert_to_numpy=True)
            if EMBED_DTYPE == 'float16':
                embeddings.extend(emb.astype('float16').tolist())
            else:
                embeddings.extend(emb.tolist())
    else:
        from concurrent.futures import ThreadPoolExecutor
        def _encode(batch):
            return embed_model.encode(batch, convert_to_numpy=True)
        with ThreadPoolExecutor(max_workers=EMBED_PARALLELISM) as ex:
            futures = [ex.submit(_encode, b) for b in batches]
            for f in futures:
                emb = f.result()
                if EMBED_DTYPE == 'float16':
                    embeddings.extend(emb.astype('float16').tolist())
                else:
                    embeddings.extend(emb.tolist())
    return embeddings


# Robustly parse chroma query results across versions
def parse_query_results(results):
    try:
        if isinstance(results, dict):
            if 'documents' in results and 'ids' in results and 'metadatas' in results:
                return results['documents'][0], results['ids'][0], results['metadatas'][0]
            if 'data' in results and isinstance(results['data'], list) and len(results['data']) > 0:
                first = results['data'][0]
                return first.get('documents', []), first.get('ids', []), first.get('metadatas', [])
    except Exception:
        pass
    return [], [], []

# Create or get collection per user
def get_collection_for_user(user_id):
    col_name = f"user_{user_id}"
    try:
        return client.get_collection(col_name)
    except Exception:
        # create collection without embedding function; we supply embeddings explicitly
        return client.create_collection(col_name)

# Provide embedding function for chroma
def get_embedding_function():
    # Use custom embedding function to avoid compatibility issues
    class CustomEmbeddingFunction:
        def __call__(self, texts):
            return embed_texts(texts)
    return CustomEmbeddingFunction()


### HNSW helper utilities (optional)
def _init_hnsw_for_user(user_id, dim, max_elements=10000):
    if not HNSW_AVAILABLE:
        return None
    idx_path = os.path.join(HNSW_DIR, f'hnsw_index_{user_id}.bin')
    map_path = os.path.join(HNSW_DIR, f'hnsw_map_{user_id}.pkl')
    if user_id in hnsw_indexes_cache:
        return hnsw_indexes_cache[user_id]
    # load mapping if exists
    mapping = {}
    rev_mapping = {}
    next_index = 0
    if os.path.exists(map_path):
        try:
            with open(map_path, 'rb') as fh:
                data = pickle.load(fh)
                mapping = data.get('mapping', {})
                rev_mapping = {v:k for k,v in mapping.items()}
                next_index = max(mapping.values()) + 1 if mapping else 0
        except Exception:
            mapping = {}
            rev_mapping = {}
            next_index = 0
    # init or load index
    index = hnswlib.Index(space='cosine', dim=dim)
    if os.path.exists(idx_path):
        try:
            index.load_index(idx_path)
        except Exception:
            # create new
            index.init_index(max_elements=max_elements, ef_construction=200, M=16)
    else:
        index.init_index(max_elements=max_elements, ef_construction=200, M=16)

    hnsw_indexes_cache[user_id] = {
        'index': index,
        'mapping': mapping,
        'rev_mapping': rev_mapping,
        'next_index': next_index,
        'idx_path': idx_path,
        'map_path': map_path
    }
    return hnsw_indexes_cache[user_id]

def _save_hnsw_map(user_id):
    entry = hnsw_indexes_cache.get(user_id)
    if not entry:
        return
    data = {'mapping': entry['mapping']}
    try:
        with open(entry['map_path'], 'wb') as fh:
            pickle.dump(data, fh)
        entry['index'].save_index(entry['idx_path'])
    except Exception:
        pass

def _add_to_hnsw(user_id, ids, vectors):
    if not HNSW_AVAILABLE or len(ids) == 0:
        return
    dim = vectors.shape[1]
    entry = _init_hnsw_for_user(user_id, dim)
    if not entry:
        return
    index = entry['index']
    mapping = entry['mapping']
    rev_mapping = entry['rev_mapping']
    next_idx = entry['next_index']
    max_needed = next_idx + len(ids)
    try:
        if max_needed > index.get_max_elements():
            index.resize_index(max_needed * 2)
    except Exception:
        pass
    # ensure vectors are float32 and normalized for cosine
    vecs = vectors.astype(np.float32)
    # normalize
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    vecs = vecs / norms
    indices = []
    to_add = []
    for i, uid in enumerate(ids):
        if uid in mapping:
            indices.append(mapping[uid])
            to_add.append(vecs[i])
        else:
            idx = next_idx
            mapping[uid] = idx
            rev_mapping[idx] = uid
            indices.append(idx)
            to_add.append(vecs[i])
            next_idx += 1
    if len(to_add) > 0:
        index.add_items(np.array(to_add, dtype=np.float32), np.array(indices, dtype=np.int32))
    entry['mapping'] = mapping
    entry['rev_mapping'] = rev_mapping
    entry['next_index'] = next_idx
    # persist
    _save_hnsw_map(user_id)

def _query_hnsw(user_id, q_vector, k):
    if not HNSW_AVAILABLE:
        return [], []
    entry = hnsw_indexes_cache.get(user_id) or _init_hnsw_for_user(user_id, q_vector.shape[0])
    if not entry:
        return [], []
    index = entry['index']
    rev = entry['rev_mapping']
    v = q_vector.astype(np.float32)
    # normalize
    norm = np.linalg.norm(v)
    if norm == 0:
        norm = 1.0
    v = v / norm
    try:
        labels, distances = index.knn_query(v, k=k)
    except Exception:
        return [], []
    labels = labels[0].tolist()
    distances = distances[0].tolist()
    ids = [rev.get(lbl) for lbl in labels if lbl in rev]
    return ids, distances

# Add chat messages to collection and graph
@app.route('/add_chat', methods=['POST'])
def add_chat():
    try:
        data = request.json
        if not data:
            return jsonify({'status': 'error', 'message': 'request body required'}), 400

        # Backwards-compatible payload: {user_id, messages:[{id,text,meta}, ...]}
        if 'messages' in data and 'user_id' in data:
            user_id = data['user_id']
            messages = data['messages']
        # New lightweight payload: {text, collection_name, optional meta}
        elif 'text' in data and 'collection_name' in data:
            text = data['text']
            coll = data['collection_name']
            # derive user_id from collection_name if prefixed, otherwise use as user_id
            if isinstance(coll, str) and coll.startswith('user_'):
                user_id = coll[len('user_'):]
            elif isinstance(coll, str) and coll.startswith('user-'):
                user_id = coll[len('user-'):]
            else:
                user_id = coll
            # construct single message entry
            msg_id = data.get('id') or f"msg-{int(time.time()*1000)}"
            meta = data.get('meta', {})
            messages = [{ 'id': msg_id, 'text': text, 'meta': meta }]
        else:
            return jsonify({'status': 'error', 'message': 'invalid payload; provide user_id+messages or text+collection_name'}), 400

        collection = get_collection_for_user(user_id)

        ids = [m['id'] for m in messages]
        texts = [m['text'] for m in messages]
        metadatas = []
        now_iso = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        for m in messages:
            meta = m.get('meta') or {}
            # normalize meta to dict
            if not isinstance(meta, dict):
                meta = {}
            # always set/override timestamp
            meta['timestamp'] = now_iso
            if 'type' not in meta:
                meta['type'] = 'chat'
            metadatas.append(meta)

        embeddings = embed_texts(texts)
        emb_array = np.array(embeddings, dtype=np.float32)
        # store as requested dtype
        if EMBED_DTYPE == 'float16':
            store_emb = emb_array.astype('float16').tolist()
        else:
            store_emb = emb_array.tolist()
        collection.add(ids=ids, documents=texts, metadatas=metadatas, embeddings=store_emb)
        # add to HNSW index for faster ANN if available
        try:
            _add_to_hnsw(user_id, ids, emb_array)
        except Exception:
            pass

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

        # update recent node cache
        if len(ids) > 0:
            recent_id = ids[-1]
            recent_node_cache[user_id] = recent_id

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
        emb_array = np.array(embeddings, dtype=np.float32)
        if EMBED_DTYPE == 'float16':
            store_emb = emb_array.astype('float16').tolist()
        else:
            store_emb = emb_array.tolist()
        collection.add(ids=ids, documents=texts, metadatas=metadatas, embeddings=store_emb)
        try:
            _add_to_hnsw(user_id, ids, emb_array)
        except Exception:
            pass
        
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
        if PROM_AVAILABLE:
            QUERY_COUNTER.inc()
            start = time.time()
        data = request.json
        if not data or 'user_id' not in data or 'query' not in data:
            return jsonify({'status': 'error', 'message': 'user_id and query required'}), 400
        
        user_id = data['user_id']
        query_text = data['query']
        top_k = data.get('top_k', 5)

        collection = get_collection_for_user(user_id)

        # Time filtering support: days / since / until
        days = data.get('days')
        since = data.get('since')
        until = data.get('until')
        since_dt = None
        until_dt = None
        if isinstance(days, (int, float)):
            since_dt = datetime.now(timezone.utc) - timedelta(days=float(days))
        if since:
            since_dt = _parse_iso_ts(since)
        if until:
            until_dt = _parse_iso_ts(until)

        # Step 1: dense seed (prefer HNSW local ANN for speed)
        nseed = GPU_NSEED
        q_emb = embed_texts([query_text])[0]
        q_vec = np.array(q_emb, dtype=np.float32)
        candidates = {}
        ids = []
        metas = []
        docs = []
        if HNSW_AVAILABLE:
            try:
                h_ids, dists = _query_hnsw(user_id, q_vec, k=nseed)
                if h_ids and len(h_ids) > 0:
                    # apply time filter to h_ids if present
                    if since_dt or until_dt:
                        allowed = _get_node_ids_in_timerange(user_id, since_dt, until_dt)
                        if allowed is not None:
                            h_ids = [hid for hid in h_ids if hid in allowed]
                    # fetch documents from chroma by ids
                    try:
                        res = collection.get(ids=h_ids, include=['documents', 'metadatas'])
                    except Exception:
                        res = collection.get(ids=h_ids)
                    docs, ids, metas = parse_query_results(res)
            except Exception:
                docs, ids, metas = [], [], []

        # fallback to chroma ANN if HNSW not available or returned nothing
        if not docs or len(docs) == 0:
            # Chroma expects Python lists for embeddings, not numpy arrays
            try:
                # If time filtering is requested, fetch more seeds and filter locally
                if since_dt or until_dt:
                    results = collection.query(query_embeddings=[q_emb], n_results=max(nseed, 200), include=['documents','metadatas','ids'])
                else:
                    results = collection.query(query_embeddings=[q_emb], n_results=nseed, include=['documents', 'metadatas'])
            except Exception:
                results = collection.query(query_embeddings=[q_emb], n_results=nseed)
            docs, ids, metas = parse_query_results(results)
            # apply time filter if requested
            if (since_dt or until_dt) and ids:
                allowed = _get_node_ids_in_timerange(user_id, since_dt, until_dt)
                if allowed is not None:
                    new_docs, new_ids, new_metas = [], [], []
                    for i, nid in enumerate(ids):
                        if nid in allowed:
                            new_docs.append(docs[i])
                            new_ids.append(ids[i])
                            new_metas.append(metas[i])
                    docs, ids, metas = new_docs, new_ids, new_metas

        for idx, doc in enumerate(docs):
            doc_id = ids[idx]
            candidates[doc_id] = {'id': doc_id, 'text': doc, 'meta': metas[idx]}

        # expand via graph neighbors
        graph_path = os.path.join(os.path.dirname(__file__), f"graph_user_{user_id}.gpickle")
        if os.path.exists(graph_path):
            G = read_graph(graph_path) or nx.DiGraph()
            hops = config.EXPAND_HOPS
            # Prevent expansion explosion by limiting total added nodes
            max_nodes = GRAPH_EXPAND_MAX_NODES
            nodes_added = 0
            for base_id in list(candidates.keys()):
                if nodes_added >= max_nodes:
                    break
                if base_id in G:
                    fringe = {base_id}
                    for _ in range(hops):
                        new_fringe = set()
                        for n in fringe:
                            for nbr in G.neighbors(n):
                                if nodes_added >= max_nodes:
                                    break
                                if nbr not in candidates:
                                    node_data = G.nodes[nbr]
                                    candidates[nbr] = {'id': nbr, 'text': node_data.get('text', ''), 'meta': node_data}
                                    nodes_added += 1
                                new_fringe.add(nbr)
                            if nodes_added >= max_nodes:
                                break
                        fringe = new_fringe
                        if nodes_added >= max_nodes:
                            break

        candidate_list = list(candidates.values())

        # Step 3: GPU cross-encoder rerank
        if GPU_USE_RERANK and cross_encoder is not None and len(candidate_list) > 0:
            # Cap number of candidates sent to cross-encoder for efficiency
            rerank_candidates = candidate_list[:GPU_RERANK_MAX_CANDIDATES]
            pairs = [(query_text, c['text'][:1000]) for c in rerank_candidates]
            try:
                scores = cross_encoder.predict(pairs, show_progress_bar=False)
            except Exception:
                scores = [0.0] * len(candidate_list)
            for i, c in enumerate(rerank_candidates):
                c['score'] = float(scores[i])
            # assign default score 0.0 to any remaining candidates we didn't rerank
            for c in candidate_list[len(rerank_candidates):]:
                c['score'] = 0.0
            candidate_list.sort(key=lambda x: x.get('score', 0.0), reverse=True)
        else:
            recent = recent_node_cache.get(user_id)
            for i, c in enumerate(candidate_list):
                c['score'] = 1.0 if c['id'] == recent else 0.0
                c['orig_rank'] = i
            candidate_list.sort(key=lambda x: ( -x['score'], x['orig_rank']))

        top = candidate_list[:top_k]
        if PROM_AVAILABLE:
            QUERY_LATENCY.observe(time.time() - start)
        return jsonify({'query': query_text, 'results': top})
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

# Health check endpoint
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'gpu_rag',
        'model': EMBED_MODEL_NAME,
        'device': DEVICE
    })


@app.route('/metrics', methods=['GET'])
def metrics():
    if not PROM_AVAILABLE:
        return jsonify({'status': 'error', 'message': 'prometheus_client not installed'}), 501
    data = generate_latest()
    return (data, 200, {'Content-Type': CONTENT_TYPE_LATEST})

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
        
        # graph stats from SQLite
        graph_stats = {'nodes': 0, 'edges': 0}
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute('SELECT COUNT(*) FROM nodes WHERE user_id=?', (user_id,))
            graph_stats['nodes'] = cur.fetchone()[0]
            cur.execute('SELECT COUNT(*) FROM edges WHERE user_id=?', (user_id,))
            graph_stats['edges'] = cur.fetchone()[0]
            conn.close()
        except Exception:
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
    app.run(host='0.0.0.0', port=5003, debug=True)
