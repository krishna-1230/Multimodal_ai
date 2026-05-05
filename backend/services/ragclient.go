package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/patrickmn/go-cache"
)

// ragServiceURL returns the base URL for the RAG service. Configure via
// RAG_BASE_URL environment variable; defaults to http://localhost:3300.
func ragServiceURL() string {
	if v := os.Getenv("RAG_BASE_URL"); v != "" {
		return v
	}
	return "http://localhost:3300"
}

// Initialize a cache with a 5-minute default expiration and 10-minute cleanup interval
var (
	queryCache      *cache.Cache
	queryCacheMutex sync.RWMutex
	cacheInitOnce   sync.Once
)

// initCache initializes the query cache if it hasn't been initialized yet
func initCache() {
	cacheInitOnce.Do(func() {
		queryCache = cache.New(5*time.Minute, 10*time.Minute)
	})
}

// --- Upload ---
type UploadFileResult struct {
	Filename    string   `json:"filename"`
	Status      string   `json:"status"`
	ChunksAdded int      `json:"chunks_added"`
	DocumentIDs []string `json:"document_ids"`
}

type UploadResult struct {
	Message string             `json:"message"`
	Results []UploadFileResult `json:"results"`
}

func UploadFiles(ctx context.Context, userUUID, collectionName string, files []io.Reader, filenames []string) (UploadResult, error) {
	var result UploadResult
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	for i, file := range files {
		part, err := writer.CreateFormFile("files", filenames[i])
		if err != nil {
			return result, err
		}
		if _, err := io.Copy(part, file); err != nil {
			return result, err
		}
	}
	writer.WriteField("collection_name", userUUID+"_"+collectionName)
	writer.Close()

	req, err := http.NewRequestWithContext(ctx, "POST", ragServiceURL()+"/upload", body)
	if err != nil {
		return result, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return result, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return result, fmt.Errorf("RAG upload failed: %s", resp.Status)
	}
	return result, json.NewDecoder(resp.Body).Decode(&result)
}

// --- Query ---
type QueryChunk struct {
	Text           string                 `json:"text"`
	Metadata       map[string]interface{} `json:"metadata"`
	RelevanceScore float64                `json:"relevance_score"`
	Source         string                 `json:"source,omitempty"`     // Source of the chunk (semantic or keyword)
	MatchType      string                 `json:"match_type,omitempty"` // Type of match (exact, partial, semantic)
}

type QueryResult struct {
	Query          string       `json:"query"`
	Answer         string       `json:"answer"`
	RelevantChunks []QueryChunk `json:"relevant_chunks"`
}

// SearchMode defines the type of search to perform
type SearchMode string

const (
	SemanticSearch SearchMode = "semantic" // Vector-based semantic search
	KeywordSearch  SearchMode = "keyword"  // Keyword/BM25 search
	HybridSearch   SearchMode = "hybrid"   // Combined semantic and keyword search
)

// QueryOptions contains additional options for querying collections
type QueryOptions struct {
	SearchMode    SearchMode `json:"search_mode,omitempty"`    // The search mode to use
	ReRankResults bool       `json:"rerank_results,omitempty"` // Whether to rerank results
	KeywordBoost  float64    `json:"keyword_boost,omitempty"`  // Boost factor for keyword search in hybrid mode
}

// QueryCollection performs a search against the RAG service with the specified options
func QueryCollection(ctx context.Context, userUUID, collectionName, query string, topK int) (QueryResult, error) {
	// Default to hybrid search with standard settings
	return QueryCollectionWithOptions(ctx, userUUID, collectionName, query, topK, QueryOptions{
		SearchMode:    HybridSearch,
		ReRankResults: true,
		KeywordBoost:  0.3, // 30% weight to keyword matches
	})
}

// QueryCollectionWithOptions performs a search against the RAG service with custom options
func QueryCollectionWithOptions(ctx context.Context, userUUID, collectionName, query string, topK int, options QueryOptions) (QueryResult, error) {
	var result QueryResult

	// Initialize cache if needed
	initCache()

	// If search mode is not specified, default to hybrid
	if options.SearchMode == "" {
		options.SearchMode = HybridSearch
	}

	// Create a cache key based on the query parameters
	cacheKey := fmt.Sprintf("%s:%s:%s:%d:%s:%.2f:%v",
		userUUID,
		collectionName,
		query,
		topK,
		options.SearchMode,
		options.KeywordBoost,
		options.ReRankResults)

	// Try to get from cache first
	queryCacheMutex.RLock()
	cachedResult, found := queryCache.Get(cacheKey)
	queryCacheMutex.RUnlock()

	if found {
		// Return the cached result
		return cachedResult.(QueryResult), nil
	}

	// Not in cache, perform the query
	payload := map[string]interface{}{
		"query":           query,
		"collection_name": userUUID + "_" + collectionName,
		"top_k":           topK,
		"search_mode":     string(options.SearchMode),
	}

	// Add optional parameters if they're set
	if options.ReRankResults {
		payload["rerank_results"] = options.ReRankResults
	}

	if options.SearchMode == HybridSearch && options.KeywordBoost > 0 {
		payload["keyword_boost"] = options.KeywordBoost
	}

	b, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", ragServiceURL()+"/query", bytes.NewReader(b))
	if err != nil {
		return result, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return result, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return result, fmt.Errorf("RAG query failed: %s", resp.Status)
	}

	// Decode the response
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return result, err
	}

	// Store in cache for future use
	queryCacheMutex.Lock()
	queryCache.Set(cacheKey, result, cache.DefaultExpiration)
	queryCacheMutex.Unlock()

	return result, nil
}

// --- Add Text ---

// AddTextRequest represents the request structure for adding text
type AddTextRequest struct {
	Text           string `json:"text"`
	CollectionName string `json:"collection_name,omitempty"`
	TopK           int    `json:"top_k,omitempty"`
}

// AddTextResponse represents the response structure for adding text
type AddTextResponse struct {
	Message     string `json:"message"`
	DocumentID  string `json:"document_id,omitempty"`
	Status      string `json:"status"`
	ChunksAdded int    `json:"chunks_added,omitempty"`
}

// AddText adds text content to a RAG collection
func AddText(ctx context.Context, text, collectionName string, topK int) (AddTextResponse, error) {
	var result AddTextResponse

	if topK == 0 {
		topK = 5
	}

	payload := AddTextRequest{
		Text:           text,
		CollectionName: collectionName,
		TopK:           topK,
	}

	b, err := json.Marshal(payload)
	if err != nil {
		return result, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", ragServiceURL()+"/add_text", bytes.NewReader(b))
	if err != nil {
		return result, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return result, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return result, fmt.Errorf("RAG add_text failed: %s", resp.Status)
	}

	err = json.NewDecoder(resp.Body).Decode(&result)
	return result, err
}

// ClearQueryCache clears the query cache
func ClearQueryCache() {
	queryCacheMutex.Lock()
	defer queryCacheMutex.Unlock()

	if queryCache != nil {
		queryCache.Flush()
	}
}

// --- List Collections ---
type ListCollectionsResult struct {
	Collections []string `json:"collections"`
}

func ListCollections(ctx context.Context, userUUID string) ([]string, error) {
	var result ListCollectionsResult
	req, err := http.NewRequestWithContext(ctx, "GET", ragServiceURL()+"/collections", nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("RAG list collections failed: %s", resp.Status)
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	// Only return collections for this user, and strip prefix for UI
	var userCollections []string
	prefix := userUUID + "_"
	for _, c := range result.Collections {
		if len(c) > len(prefix) && c[:len(prefix)] == prefix {
			userCollections = append(userCollections, c[len(prefix):])
		}
	}
	return userCollections, nil
}

// --- Delete Collection ---
func DeleteCollection(ctx context.Context, userUUID, collectionName string) error {
	fullName := userUUID + "_" + collectionName
	url := fmt.Sprintf("%s/collections/%s", ragServiceURL(), fullName)
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("RAG delete collection failed: %s", resp.Status)
	}
	return nil
}
