## Graph RAG Microservices API

This document describes the public HTTP endpoints provided by the CPU and GPU microservices. The two services expose the same API; the CPU service runs by default on port `5001` and the GPU service runs on port `5002`.

- **CPU service**: http://<host>:5001
- **GPU service**: http://<host>:5003

---

## Common behavior
- Each user has a separate Chroma collection named `user_<user_id>` and a NetworkX graph file `graph_user_<user_id>.gpickle` stored in the service directory.
- Environment variables affect runtime behavior:
  - `CPU_EMBED_MODEL`, `GPU_EMBED_MODEL` — embedding model names
  - `CPU_USE_RERANK`, `GPU_USE_RERANK` — enable cross-encoder reranking (`true`/`false`)
  - `CPU_RERANK_MODEL`, `GPU_RERANK_MODEL` — reranker model names
  - `EXPAND_HOPS` — how many hops to expand in the graph (default `1`)

---

## Endpoints

### `POST /add_chat`
Add chat messages (sequence) to the user's collection and graph.

**Accepts two payload formats:**

#### Format 1: Batch messages (classic)
```json
{
  "user_id": "alice",
  "messages": [
    {"id": "m1", "text": "Hello, this is Alice.", "meta": {"timestamp": 1690000000}},
    {"id": "m2", "text": "I like pizza.", "meta": {"timestamp": 1690000300}}
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User identifier |
| `messages` | array | Yes | Array of message objects |
| `messages[].id` | string | Yes | Unique message ID |
| `messages[].text` | string | Yes | Message content |
| `messages[].meta` | object | No | Optional metadata (timestamp, etc.) |

#### Format 2: Lightweight single message (GPU service only)
```json
{
  "text": "Hello, this is my message",
  "collection_name": "user_alice",
  "id": "optional-custom-id",
  "meta": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Message content |
| `collection_name` | string | Yes | Collection name (e.g., `user_alice` or just `alice`) |
| `id` | string | No | Custom message ID (auto-generated as `msg-<timestamp>` if not provided) |
| `meta` | object | No | Optional metadata |

**Notes:**
- Timestamps are automatically set to current UTC time in ISO format
- Messages are linked sequentially in the graph (edge from m1 → m2 → m3...)
- `meta.type` defaults to `"chat"` if not specified

Response (200):
```json
{"status": "ok", "added": 2}
```

Errors (400): returns `{"status":"error","message":"..."}` when input missing or invalid.

---

### `POST /add_docs`
Upload document nodes (not chat sequence). Documents are stored in the collection and added as isolated nodes in the graph.

Request body (JSON):
```json
{
  "user_id": "alice",
  "documents": [
    {"id": "d1", "title": "Spec", "text": "This is the spec.", "meta": {"source": "upload"}}
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User identifier |
| `documents` | array | Yes | Array of document objects |
| `documents[].id` | string | Yes | Unique document ID |
| `documents[].text` | string | Yes | Document content |
| `documents[].title` | string | No | Optional document title |
| `documents[].meta` | object | No | Optional metadata |

**Notes:**
- Documents are added as isolated nodes (no edges between them)
- `meta.type` is automatically set to `"document"`

Response (200):
```json
{"status": "ok", "added": 1}
```

---

### `POST /query`
Retrieve RAG results for a user query. This performs: dense retrieval (Chroma/HNSW) → graph expansion (neighbors) → optional cross-encoder rerank.

Request body (JSON):
```json
{
  "user_id": "alice",
  "query": "What does Alice like?",
  "top_k": 5,
  "days": 7,
  "since": "2024-01-01T00:00:00Z",
  "until": "2024-12-31T23:59:59Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User identifier |
| `query` | string | Yes | Query text |
| `top_k` | integer | No | Number of results to return (default: 5) |
| `days` | number | No | Filter to messages from last N days (GPU only) |
| `since` | string | No | Filter to messages after this ISO timestamp (GPU only) |
| `until` | string | No | Filter to messages before this ISO timestamp (GPU only) |

Response (200):
```json
{
  "query": "What does Alice like?",
  "results": [
    {"id": "m2", "text": "I like pizza.", "meta": {"timestamp": 1690000300}, "score": 0.9},
    {"id": "m1", "text": "Hello, this is Alice.", "meta": {"timestamp": 1690000000}, "score": 0.1}
  ]
}
```

**Notes:**
- `score` is present when reranking is enabled; otherwise simple recency/original-rank signals are used
- GPU service uses HNSW for faster ANN when available
- Time filtering parameters (`days`, `since`, `until`) are only available in GPU service

---

### `GET /health`
Simple health check.

Response (200):
```json
{"status": "healthy", "service": "cpu_rag", "model": "all-MiniLM-L6-v2", "device": "cpu"}
```

| Field | Description |
|-------|-------------|
| `status` | Always `"healthy"` if service is running |
| `service` | `"cpu_rag"` or `"gpu_rag"` |
| `model` | Embedding model name in use |
| `device` | `"cpu"` or `"cuda"` |

---

### `GET /metrics` (GPU service only)
Prometheus metrics endpoint. Returns Prometheus-format metrics for monitoring.

Response (200): Prometheus text format with:
- `gpu_rag_queries_total` — Total queries received
- `gpu_rag_query_latency_seconds` — Query latency histogram
- `gpu_rag_adds_total` — Total documents/messages added

Response (501): `{"status":"error","message":"prometheus_client not installed"}` if prometheus_client is not available.

---

### `GET /user_stats?user_id=<user_id>`
Get basic stats about a user's collection and graph.

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `user_id` | string | Yes | User identifier |

Response (200):
```json
{
  "user_id": "alice",
  "document_count": 42,
  "graph_stats": {"nodes": 30, "edges": 28},
  "recent_node": "m2"
}
```

---
### `DELETE /clear_user`
Remove a user's collection and graph file.

Request body (JSON):
```json
{"user_id": "alice"}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User identifier to clear |

Response (200):
```json
{"status": "ok", "message": "User alice data cleared"}
```

---

### `GET /list_users`
List all user collections (returns `user_id` values).

Response (200):
```json
{"users": ["alice", "bob"], "count": 2}
```

---
## Environment Variables

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `CPU_EMBED_MODEL` | CPU | `all-MiniLM-L6-v2` | Embedding model name |
| `GPU_EMBED_MODEL` | GPU | `sentence-transformers/all-mpnet-base-v2` | Embedding model name |
| `CPU_USE_RERANK` | CPU | `false` | Enable cross-encoder reranking |
| `GPU_USE_RERANK` | GPU | `true` | Enable cross-encoder reranking |
| `CPU_RERANK_MODEL` | CPU | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Reranker model |
| `GPU_RERANK_MODEL` | GPU | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Reranker model |
| `EXPAND_HOPS` | Both | `1` | Graph expansion hops |
| `GPU_NSEED` | GPU | `50` | Max seed results from ANN |
| `GPU_RERANK_MAX_CANDIDATES` | GPU | `50` | Max candidates for reranker |
| `GRAPH_EXPAND_MAX_NODES` | GPU | `200` | Max nodes during graph expansion |
| `EMBED_DTYPE` | GPU | `float32` | Embedding storage dtype (`float32`/`float16`) |
| `EMBED_PARALLELISM` | GPU | `1` | CPU parallelism for embedding |

---

## Examples & usage notes
- To switch between CPU and GPU microservices, point your client to the appropriate host:port (5001 CPU, 5002 GPU).
- For large uploads, ensure `id` values are unique per user.
- Graph condensation (periodic compaction into summary nodes) is implemented in `common/condense.py` and can be run independently.
---

If you want, I can also add a `curl` example per endpoint or put this file under `cpu_service/` and `gpu_service/` directories — which do you prefer?