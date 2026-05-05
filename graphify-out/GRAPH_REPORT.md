# Graph Report - Final_project  (2026-05-05)

## Corpus Check
- 92 files · ~212,147 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 507 nodes · 661 edges · 64 communities (52 shown, 12 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]

## God Nodes (most connected - your core abstractions)
1. `_req()` - 21 edges
2. `ChatMemoryService` - 14 edges
3. `RAGEngine` - 14 edges
4. `useAuth()` - 13 edges
5. `saveBytesForUser()` - 12 edges
6. `toString()` - 12 edges
7. `ProcessMultiTopicRagWithHistory()` - 12 edges
8. `downloadToUser()` - 11 edges
9. `LogInfo()` - 11 edges
10. `extractAndSaveToLibrary()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `ProfilePageContent()` --calls--> `useAuth()`  [INFERRED]
  frontend/src/app/profile/page.jsx → frontend/src/hooks/useAuth.js
- `main()` --calls--> `InitLoggers()`  [INFERRED]
  backend/main.go → backend/utils/logger.go
- `main()` --calls--> `LogInfo()`  [INFERRED]
  backend/main.go → backend/utils/logger.go
- `main()` --calls--> `Connect()`  [INFERRED]
  backend/main.go → backend/database/connection.go
- `main()` --calls--> `LogError()`  [INFERRED]
  backend/main.go → backend/utils/logger.go

## Communities (64 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (38): Chat(), ChatRequest, ChatResponse, ListMCPs(), AddText(), Query(), SpeechRag(), Speech() (+30 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (36): BaseModel, add_text(), delete_collection(), list_collections(), query_documents(), QueryRequest, Query the RAG system with a question about the documents.     Returns an answer, List all available collections in the vector database. (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (42): append_block_children(), create_comment(), create_database(), create_page(), delete_block(), get_block(), get_block_children(), get_comments() (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (12): ChatPageContent(), ChatPageContent(), AuthGuard(), DeepResearchPageContent(), FluxKontextPageContent(), FluxPageContent(), useAuth(), MusicGenPageContent() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (24): DeepResearch(), downloadBytes(), downloadToUser(), ensureDir(), extractAndSaveToLibrary(), first(), Flux(), FluxContextOne() (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (17): add_chat(), add_docs(), _add_to_hnsw(), embed_texts(), get_collection_for_user(), _get_db_lock(), _get_node_ids_in_timerange(), _init_hnsw_for_user() (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (14): main(), Connect(), CORS(), isAllowedOrigin(), ChatEmbedding, ChatMemoryBuffer, ChatSummary, AutoMigrate() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (16): Upload(), AddTextRequest, AddTextResponse, ListCollectionsResult, QueryChunk, QueryOptions, QueryResult, AddText() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (8): RAGEngine, Query the RAG system with a question.          Args:             query_text: The, List all available collections in the vector database., Delete a collection from the vector database., Generate embeddings for a list of texts., Rerank documents based on relevance to the query using cross-encoder.          A, Get or create a ChromaDB collection., Add documents to the vector database.                  Args:             documen

### Community 9 - "Community 9"
Cohesion: 0.19
Nodes (14): create_text_chunks(), extract_text_from_docx(), extract_text_from_image(), extract_text_from_pdf(), extract_text_from_txt(), process_document(), Extract text from a PDF file., Extract text from a DOCX file. (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (14): create_text_chunks(), extract_text_from_docx(), extract_text_from_image(), extract_text_from_pdf(), extract_text_from_txt(), process_document(), Extract text from a PDF file., Extract text from a DOCX file. (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.3
Nodes (9): add_chat(), add_docs(), embed_texts(), get_collection_for_user(), parse_query_results(), query(), read_graph(), user_stats() (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.19
Nodes (9): Login(), Signup(), LoginInput, SignupInput, AdminOnly(), JWTMiddleware(), ExtractUserUUIDFromToken(), GenerateJWT() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (4): resolveMediaUrl(), mediaURL(), ProfilePageContent(), renderThumb()

### Community 14 - "Community 14"
Cohesion: 0.38
Nodes (8): buildAgentMediaOutput(), CreateAgentChat(), extractAgentMediaOutputs(), inferAgentOutputType(), saveAgentOutputs(), saveAgentRawOutput(), saveAgentSingleOutput(), shouldIgnoreAgentMediaPath()

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (8): get_system_info(), monitor_performance(), optimize_gpu_settings(), print_optimization_tips(), Monitor real-time performance metrics., Get comprehensive system information., Optimize GPU settings for RTX 3060 with 12GB VRAM., Print optimization tips for RTX 3060.

### Community 19 - "Community 19"
Cohesion: 0.7
Nodes (4): runTests(), testDirectConversion(), testDriveUpload(), testLocalStorage()

## Knowledge Gaps
- **105 isolated node(s):** `SignupInput`, `LoginInput`, `ChatRequest`, `ChatResponse`, `SpeechRequest` (+100 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `Community 6` to `Community 0`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `LogInfo()` connect `Community 0` to `Community 6`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `RAGEngine` (e.g. with `QueryRequest` and `TextInputRequest`) actually correct?**
  _`RAGEngine` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `useAuth()` (e.g. with `ChatPageContent()` and `ChatPageContent()`) actually correct?**
  _`useAuth()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `SignupInput`, `LoginInput`, `ChatRequest` to the rest of the system?**
  _105 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._