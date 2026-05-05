import os
import networkx as nx
import pickle
from sentence_transformers import SentenceTransformer
from sklearn.cluster import AgglomerativeClustering
import numpy as np
from datetime import datetime, timedelta
from common import config

EMBED_MODEL_NAME = 'all-MiniLM-L6-v2'
embed_model = SentenceTransformer(EMBED_MODEL_NAME)

# This script clusters old message nodes for a given user and replaces them with a summary node.
# It's intentionally simple: it computes embeddings for nodes older than REPLACE_OLD_THAN_DAYS and clusters them.

def condense_user_graph(user_graph_path):
    if not os.path.exists(user_graph_path):
        return 0
    try:
        with open(user_graph_path, 'rb') as fh:
            G = pickle.load(fh)
    except Exception:
        return 0
    cutoff = datetime.utcnow() - timedelta(days=config.REPLACE_OLD_THAN_DAYS)
    old_nodes = []
    for n, d in G.nodes(data=True):
        ts = d.get('timestamp')
        if ts is None:
            continue
        try:
            node_time = datetime.utcfromtimestamp(float(ts))
        except Exception:
            continue
        if node_time < cutoff:
            old_nodes.append((n, d))
    if len(old_nodes) < 2:
        return 0

    texts = [d.get('text', '') for _, d in old_nodes]
    embs = embed_model.encode(texts, convert_to_numpy=True)

    # cluster into sqrt(n) clusters as heuristic
    n_clusters = max(1, int(np.sqrt(len(texts))))
    clustering = AgglomerativeClustering(n_clusters=n_clusters)
    labels = clustering.fit_predict(embs)

    # create summary nodes per cluster
    for lbl in set(labels):
        members = [old_nodes[i] for i in range(len(labels)) if labels[i] == lbl]
        if not members:
            continue
        summary_texts = [m[1].get('text', '') for m in members]
        summary_text = ' '.join(summary_texts[:5])
        summary_id = f"summary_{int(datetime.utcnow().timestamp())}_{lbl}"
        G.add_node(summary_id, text=summary_text, summary=True, timestamp=datetime.utcnow().timestamp())
        # link summary node with edges from/to members' neighbors
        for m_id, mdata in members:
            for pred in G.predecessors(m_id):
                G.add_edge(pred, summary_id)
            for succ in G.successors(m_id):
                G.add_edge(summary_id, succ)
            G.remove_node(m_id)

    try:
        with open(user_graph_path, 'wb') as fh:
            pickle.dump(G, fh)
    except Exception:
        try:
            nx.write_gpickle(G, user_graph_path)
        except Exception:
            pass
    return 1


if __name__ == '__main__':
    # run over all graph files in both services
    base_dirs = ['cpu_service', 'gpu_service']
    for base in base_dirs:
        for fname in os.listdir(base):
            if fname.startswith('graph_user_') and fname.endswith('.gpickle'):
                path = os.path.join(base, fname)
                try:
                    r = condense_user_graph(path)
                    if r:
                        print(f"Condensed {path}")
                except Exception as e:
                    print(f"Failed to condense {path}: {e}")
