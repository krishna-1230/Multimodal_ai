package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"backend/models"
	"backend/utils"
)

type Part struct {
	Text string `json:"text"`
}

type Content struct {
	Role  string `json:"role"` // "user" or "model" only
	Parts []Part `json:"parts"`
}

type GeminiRequest struct {
	Contents []Content `json:"contents"`
}

type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

type GeminiCandidate struct {
	Content GeminiContent `json:"content"`
}

type GeminiResponse struct {
	Candidates []GeminiCandidate `json:"candidates"`
}

func GetGeminiReply(messages []models.Message) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("gemini API key not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	// Convert messages to Gemini format with role normalization
	var contents []Content
	for _, msg := range messages {
		role := msg.Role
		if role == "ai" {
			role = "model" // normalize old value
		}
		if role != "user" && role != "model" {
			continue // skip invalid roles just in case
		}
		contents = append(contents, Content{
			Role:  role,
			Parts: []Part{{Text: msg.Content}},
		})
	}

	reqBody := GeminiRequest{Contents: contents}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

// GetGeminiReplyWithContext sends pre-built context to Gemini
func GetGeminiReplyWithContext(contents []Content) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("gemini API key not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	reqBody := GeminiRequest{Contents: contents}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

// ProcessRagWithGemini sends RAG query results to Gemini for processing
func ProcessRagWithGemini(query string, chunks []QueryChunk) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("gemini API key not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	// Build prompt with query and relevant chunks
	var promptBuilder strings.Builder
	promptBuilder.WriteString("Based on the following information, please answer this question:\n\n")
	promptBuilder.WriteString("Question: " + query + "\n\n")
	promptBuilder.WriteString("Context Information:\n")

	for i, chunk := range chunks {
		promptBuilder.WriteString(fmt.Sprintf("\n--- Chunk %d ---\n", i+1))
		promptBuilder.WriteString(chunk.Text)
		if chunk.Metadata != nil {
			source, hasSource := chunk.Metadata["source"].(string)
			if hasSource {
				promptBuilder.WriteString(fmt.Sprintf("\n(Source: %s)", source))
			}
		}
		promptBuilder.WriteString("\n")
	}

	promptBuilder.WriteString("\nPlease provide a comprehensive answer to the question based only on the information provided above.")

	// Create request
	contents := []Content{
		{
			Role:  "user",
			Parts: []Part{{Text: promptBuilder.String()}},
		},
	}

	reqBody := GeminiRequest{Contents: contents}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

// OptimizeRagQuery uses Gemini to create optimized RAG queries from a user query
// It analyzes the user query and creates optimized sub-queries for RAG
func OptimizeRagQuery(userQuery string) ([]string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("gemini API key not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	// Build prompt to extract optimized RAG queries
	prompt := fmt.Sprintf(`
Your task is to analyze the following user query and extract optimized search queries for a RAG system.

User Query: %s

If the user query contains multiple topics or requires information from multiple domains, extract separate, focused search queries for each topic or domain. If it's a single topic query, optimize it for search.

Output ONLY a JSON array of strings, each string being an optimized search query. For example:
["optimized query 1", "optimized query 2", "optimized query 3"]

Do not include any explanations or additional text in your response, just the JSON array.
`, userQuery)

	// Create request
	contents := []Content{
		{
			Role:  "user",
			Parts: []Part{{Text: prompt}},
		},
	}

	reqBody := GeminiRequest{Contents: contents}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gemini API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return nil, err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	// Parse the JSON array from the response
	responseText := geminiResp.Candidates[0].Content.Parts[0].Text
	// Clean the response (remove markdown code blocks if present)
	responseText = strings.TrimSpace(responseText)
	if strings.HasPrefix(responseText, "```json") {
		responseText = strings.TrimPrefix(responseText, "```json")
		responseText = strings.TrimSuffix(responseText, "```")
		responseText = strings.TrimSpace(responseText)
	} else if strings.HasPrefix(responseText, "```") {
		responseText = strings.TrimPrefix(responseText, "```")
		responseText = strings.TrimSuffix(responseText, "```")
		responseText = strings.TrimSpace(responseText)
	}

	var queries []string
	if err := json.Unmarshal([]byte(responseText), &queries); err != nil {
		return nil, fmt.Errorf("failed to parse optimized queries: %v", err)
	}

	return queries, nil
}

// ProcessMultiTopicRag handles RAG queries with multiple topics
// It optimizes the query, retrieves relevant chunks for each sub-query, and combines the results
func ProcessMultiTopicRag(ctx context.Context, userUUID, collectionName, userQuery string, topK int) (QueryResult, error) {
	var combinedResult QueryResult
	combinedResult.Query = userQuery

	// Get optimized queries
	optimizedQueries, err := OptimizeRagQuery(userQuery)
	if err != nil {
		return combinedResult, fmt.Errorf("failed to optimize query: %v", err)
	}

	// If no optimized queries were generated, use the original query
	if len(optimizedQueries) == 0 {
		return QueryCollection(ctx, userUUID, collectionName, userQuery, topK)
	}

	// Log the optimized queries
	utils.LogInfo("Original query: %s", userQuery)
	utils.LogInfo("Optimized into %d sub-queries", len(optimizedQueries))
	for i, q := range optimizedQueries {
		utils.LogInfo("  %d. %s", i+1, q)
	}

	// Calculate topK for each sub-query to avoid overwhelming results
	// Ensure at least 3 results per query, but still respect the overall topK limit
	subQueryTopK := topK / len(optimizedQueries)
	if subQueryTopK < 3 {
		subQueryTopK = 3
	}

	// If the minimum chunks per topic would exceed the total requested,
	// adjust the total topK to accommodate the minimum
	if subQueryTopK*len(optimizedQueries) > topK {
		utils.LogInfo("Adjusted total chunks from %d to %d to ensure minimum of %d chunks per topic",
			topK, subQueryTopK*len(optimizedQueries), subQueryTopK)
	}

	// Execute each optimized query and collect chunks
	var allChunks []QueryChunk
	for _, query := range optimizedQueries {
		result, err := QueryCollection(ctx, userUUID, collectionName, query, subQueryTopK)
		if err != nil {
			utils.LogWarning("Error querying for '%s': %v", query, err)
			continue // Skip failed queries but continue with others
		}

		utils.LogInfo("Query '%s' returned %d chunks", query, len(result.RelevantChunks))

		// Add chunks to combined result
		allChunks = append(allChunks, result.RelevantChunks...)
	}

	// Remove duplicate chunks based on content
	uniqueChunks := make([]QueryChunk, 0)
	seen := make(map[string]bool)

	for _, chunk := range allChunks {
		// Use text as a unique identifier
		if _, exists := seen[chunk.Text]; !exists {
			seen[chunk.Text] = true
			uniqueChunks = append(uniqueChunks, chunk)
		}
	}

	utils.LogInfo("Total chunks after deduplication: %d", len(uniqueChunks))
	combinedResult.RelevantChunks = uniqueChunks

	// If we have chunks, process them with the original user query
	if len(uniqueChunks) > 0 {
		answer, err := ProcessRagWithGemini(userQuery, uniqueChunks)
		if err == nil {
			combinedResult.Answer = answer
		} else {
			utils.LogWarning("Error processing with Gemini: %v", err)
			combinedResult.Answer = "Unable to process the multi-topic query."
		}
	} else {
		combinedResult.Answer = "No relevant information found for your query."
	}

	return combinedResult, nil
}

// ClassifyQueryType uses Gemini to determine if a query is a follow-up/contextual or a new topic
func ClassifyQueryType(userQuery string, history []models.RagMessage) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("gemini API key not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	// Build conversation context for classification
	var contextBuilder strings.Builder
	contextBuilder.WriteString("Conversation so far:\n")
	for _, msg := range history {
		if msg.Role == "user" {
			contextBuilder.WriteString("User: ")
		} else {
			contextBuilder.WriteString("System: ")
		}
		contextBuilder.WriteString(msg.Content)
		contextBuilder.WriteString("\n")
	}
	contextBuilder.WriteString("User: ")
	contextBuilder.WriteString(userQuery)
	contextBuilder.WriteString("\n")

	// Debug print: Show the conversation history being sent to classifier
	fmt.Printf("=== CONVERSATION HISTORY FOR CLASSIFIER ===\n")
	fmt.Printf("History length: %d messages\n", len(history))
	for i, msg := range history {
		fmt.Printf("[%d] %s: %s\n", i+1, msg.Role, msg.Content)
	}
	fmt.Printf("Current Query: %s\n", userQuery)
	fmt.Printf("=== END CONVERSATION HISTORY ===\n")

	prompt := `You are a precise query classifier for a RAG system. Analyze the conversation history and the user's latest message to determine the optimal retrieval strategy.

Classification Rules:

1. "follow-up" — The user's message EXCLUSIVELY references or builds upon information already present in the conversation without needing new retrieval:
   - Requests clarification/explanation of previously mentioned content
   - Asks for rephrasing, summarization, or elaboration of existing information  
   - Questions about terms, concepts, or details already discussed
   - Requests different formatting/presentation of existing content
   - Meta-questions about the conversation itself
   - Simple yes/no questions about previously discussed information
   Key indicators: "that", "this", "what you said", "the previous", "earlier", "above", "explain that", "what does this mean", "can you clarify", "I don't understand"

2. "new_topic" — The user introduces a completely new subject or asks questions that require fresh information retrieval:
   - Initial questions about unexplored topics
   - Requests for information not previously mentioned
   - Questions that would benefit from comprehensive document search
   - Broad exploratory queries
   - Topic shifts with no reference to prior discussion
   - Questions that cannot be answered with the information already provided
   Key indicators: No references to previous content, introduces new subject matter, asks "what is", "tell me about", "explain", "how does" for new concepts

3. "combined" — The user references previous conversation AND requires additional information that likely needs new retrieval:
   - Builds on discussed topics but asks for expansion beyond current context
   - References prior content while seeking related/connected information
   - Requests comprehensive coverage that spans previous + new information
   - Questions that connect discussed topics to unexplored areas
   - Follow-up questions that naturally lead to broader information needs
   - Questions that ask for more specific details about a previously mentioned topic
   Key indicators: "tell me more about", "what else", "also", "in addition", "building on", "expand on", "give me more details about", "can you provide examples", "how does X relate to Y"

Decision Framework:
1. Check conversation dependency: Does the query make sense without prior context?
   - If NO → likely "follow-up" or "combined"
   - If YES → continue analysis

2. Assess information sufficiency: Can this be answered fully with information already in the conversation?
   - If YES → "follow-up"  
   - If NO → continue analysis

3. Evaluate scope expansion: Does the query seek to expand beyond what's been discussed?
   - If YES and references prior content → "combined"
   - If YES and doesn't reference prior content → "new_topic"

4. Consider semantic similarity: Is the query semantically similar to previous questions but asking for new details?
   - If YES → "combined"
   - If NO → continue analysis

Edge Cases:
- Empty/unclear messages → "new_topic"
- First message in conversation → "new_topic"  
- Requests for examples of discussed concepts → "combined" (likely needs retrieval for specific examples)
- Questions bridging multiple discussed topics → "combined"
- Comparative questions using prior content → "combined"
- Questions that ask "why" about previously stated facts → "combined" (likely needs retrieval for explanations)

Output only one word: "follow-up", "new_topic", or "combined".

Prioritize user intent and information retrieval needs over linguistic patterns. When in doubt between "follow-up" and "combined", prefer "combined" to ensure comprehensive information retrieval.`

	fullPrompt := contextBuilder.String() + "\n" + prompt

	contents := []Content{
		{
			Role:  "user",
			Parts: []Part{{Text: fullPrompt}},
		},
	}

	reqBody := GeminiRequest{Contents: contents}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini")
	}

	classification := strings.TrimSpace(strings.ToLower(geminiResp.Candidates[0].Content.Parts[0].Text))
	if strings.Contains(classification, "follow-up") {
		return "follow-up", nil
	} else if strings.Contains(classification, "new_topic") {
		return "new_topic", nil
	} else if strings.Contains(classification, "combined") {
		return "combined", nil
	}
	return "", fmt.Errorf("unexpected classification: %s", classification)
}

// MergedClassificationAndQueries combines query classification and smart query generation in one API call
type ClassificationAndQueriesResult struct {
	QueryType     string   `json:"query_type"`     // "follow-up", "new_topic", or "combined"
	SearchQueries []string `json:"search_queries"` // Empty for "follow-up", populated for others
	Reasoning     string   `json:"reasoning"`      // Brief explanation of the classification
}

// ClassifyAndGenerateQueries performs both classification and query expansion in a single API call
// This reduces 2 API calls to 1, improving latency and reducing costs
func ClassifyAndGenerateQueries(userQuery string, history []models.RagMessage) (ClassificationAndQueriesResult, error) {
	result := ClassificationAndQueriesResult{}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return result, fmt.Errorf("gemini API key not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	// Build conversation context for classification and query generation
	var contextBuilder strings.Builder
	contextBuilder.WriteString("Conversation context:\n")

	// Only include the most recent exchanges (up to 2 exchanges = 4 messages)
	recentHistory := history
	if len(history) > 4 {
		recentHistory = history[len(history)-4:]
		contextBuilder.WriteString("[Note: Earlier conversation history omitted]\n")
	}

	for _, msg := range recentHistory {
		if msg.Role == "user" {
			contextBuilder.WriteString("User: ")
		} else {
			contextBuilder.WriteString("System: ")
		}
		contextBuilder.WriteString(msg.Content)
		contextBuilder.WriteString("\n")
	}

	// Single comprehensive prompt that handles both classification and query generation
	prompt := fmt.Sprintf(`You are an expert RAG system optimizer. Analyze the conversation context and user query, then provide both classification and search queries in a single response.

CONVERSATION CONTEXT:
%s

CURRENT QUESTION: %s

TASK: Perform both classification and query expansion in one step.

CLASSIFICATION RULES:
1. "follow-up" — Query exclusively references/builds upon information already in conversation
2. "new_topic" — Query introduces completely new subject requiring fresh retrieval
3. "combined" — Query references prior content AND requires additional information

OUTPUT FORMAT (JSON):
{
  "query_type": "follow-up|new_topic|combined",
  "search_queries": ["query1", "query2", "query3"] or [],
  "reasoning": "Brief explanation of classification and query strategy"
}

For "follow-up": search_queries should be empty array []
For "new_topic" and "combined": provide 3-5 optimized search queries
Queries should be specific, use precise terminology, and maximize retrieval precision.`, contextBuilder.String(), userQuery)

	contents := []Content{
		{
			Role:  "user",
			Parts: []Part{{Text: prompt}},
		},
	}

	reqBody := GeminiRequest{Contents: contents}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return result, err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return result, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return result, fmt.Errorf("gemini merged classification API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return result, err
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return result, err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return result, fmt.Errorf("empty response from Gemini")
	}

	responseText := geminiResp.Candidates[0].Content.Parts[0].Text

	// Parse JSON response
	if err := json.Unmarshal([]byte(responseText), &result); err != nil {
		// Fallback: try to extract JSON from markdown code blocks
		cleanedText := strings.TrimSpace(responseText)
		if strings.HasPrefix(cleanedText, "```json") {
			cleanedText = strings.TrimPrefix(cleanedText, "```json")
			cleanedText = strings.TrimSuffix(cleanedText, "```")
			cleanedText = strings.TrimSpace(cleanedText)
			if err := json.Unmarshal([]byte(cleanedText), &result); err != nil {
				return result, fmt.Errorf("failed to parse merged classification response: %v", err)
			}
		} else {
			return result, fmt.Errorf("failed to parse merged classification response: %v", err)
		}
	}

	// Validate and normalize the result
	result.QueryType = strings.TrimSpace(strings.ToLower(result.QueryType))
	if result.QueryType != "follow-up" && result.QueryType != "new_topic" && result.QueryType != "combined" {
		utils.LogWarning("Unexpected query type '%s', defaulting to 'new_topic'", result.QueryType)
		result.QueryType = "new_topic"
	}

	utils.LogInfo("Merged classification result: type=%s, queries=%d, reasoning=%s",
		result.QueryType, len(result.SearchQueries), result.Reasoning)

	return result, nil
}

// GenerateSmartRagQueries creates multiple search queries for comprehensive document coverage
func GenerateSmartRagQueries(userQuery string, history []models.RagMessage) ([]string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("gemini API key not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	// Build conversation context - only include the most recent exchanges for efficiency
	var contextBuilder strings.Builder
	contextBuilder.WriteString("Conversation context:\n")

	// Only include the most recent exchanges (up to 2 exchanges = 4 messages)
	recentHistory := history
	if len(history) > 4 {
		recentHistory = history[len(history)-4:]
		contextBuilder.WriteString("[Note: Earlier conversation history omitted]\n")
	}

	for _, msg := range recentHistory {
		if msg.Role == "user" {
			contextBuilder.WriteString("User: ")
		} else {
			contextBuilder.WriteString("System: ")
		}
		contextBuilder.WriteString(msg.Content)
		contextBuilder.WriteString("\n")
	}

	prompt := fmt.Sprintf(`You are an expert search query generator for a RAG (Retrieval Augmented Generation) system. Your task is to analyze the user's question and conversation context to generate 3-5 highly effective search queries that will retrieve the most relevant information from a document database.

CONVERSATION CONTEXT:
%s

CURRENT QUESTION: %s

INSTRUCTIONS:
1. Generate 3-5 search queries that will retrieve the most relevant information to answer the user's question
2. Each query should focus on a different aspect or angle of the question
3. Queries should be specific and use precise terminology likely to appear in relevant documents
4. Include key entities, concepts, and relationships mentioned in the question
5. For complex questions, break them down into simpler component queries
6. Consider both explicit and implicit information needs
7. Avoid overly broad or generic queries
8. Ensure queries are in natural language format (not keyword lists)
9. Each query should be self-contained and make sense on its own
10. Prioritize precision over recall - better to have fewer highly relevant results

FORMAT YOUR RESPONSE AS:
1. [First search query]
2. [Second search query]
3. [Third search query]
4. [Fourth search query - optional]
5. [Fifth search query - optional]

EXAMPLES:
For the question "What are the environmental impacts of electric vehicles?":
1. Environmental benefits of electric vehicles compared to combustion engines
2. Negative environmental impacts of electric vehicle battery production
3. Carbon footprint analysis of electric vehicles lifecycle
4. Electric vehicle rare earth mineral mining environmental consequences
5. Electric vehicle charging infrastructure environmental considerations`, contextBuilder.String(), userQuery)

	contents := []Content{
		{
			Role:  "user",
			Parts: []Part{{Text: prompt}},
		},
	}

	reqBody := GeminiRequest{Contents: contents}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gemini API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return nil, err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	// Parse the generated queries
	response := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
	lines := strings.Split(response, "\n")

	var queries []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") && !strings.HasPrefix(line, "-") {
			// Remove numbering if present
			if strings.Contains(line, ".") {
				parts := strings.SplitN(line, ".", 2)
				if len(parts) > 1 && len(parts[0]) <= 3 { // Only remove if it looks like a number (1-3 chars)
					line = strings.TrimSpace(parts[1])
				}
			}
			if line != "" {
				queries = append(queries, line)
			}
		}
	}

	// If no queries generated, fallback to original query
	if len(queries) == 0 {
		queries = []string{userQuery}
	}

	// Add the original query if it's not too similar to any generated query
	addOriginal := true
	for _, q := range queries {
		if similarityScore(userQuery, q) > 0.7 { // If 70% similar, don't add original
			addOriginal = false
			break
		}
	}

	if addOriginal && len(queries) < 5 {
		queries = append(queries, userQuery)
	}

	// Limit to 5 queries maximum
	if len(queries) > 5 {
		queries = queries[:5]
	}

	utils.LogInfo("Generated %d smart RAG queries: %v", len(queries), queries)
	return queries, nil
}

// similarityScore calculates a simple similarity score between two strings
// Returns a value between 0 (completely different) and 1 (identical)
func similarityScore(a, b string) float64 {
	// Convert to lowercase for case-insensitive comparison
	a = strings.ToLower(a)
	b = strings.ToLower(b)

	// Split into words
	aWords := strings.Fields(a)
	bWords := strings.Fields(b)

	// Count matching words
	matches := 0
	aWordMap := make(map[string]bool)

	for _, word := range aWords {
		aWordMap[word] = true
	}

	for _, word := range bWords {
		if aWordMap[word] {
			matches++
		}
	}

	// Calculate Jaccard similarity coefficient
	totalUniqueWords := len(aWordMap)
	for _, word := range bWords {
		if !aWordMap[word] {
			totalUniqueWords++
		}
	}

	if totalUniqueWords == 0 {
		return 0
	}

	return float64(matches) / float64(totalUniqueWords)
}

// reRankChunks re-ranks chunks based on multiple relevance factors
// Returns a new slice of chunks sorted by the calculated relevance score
func reRankChunks(chunks []QueryChunk, query string) ([]QueryChunk, error) {
	if len(chunks) == 0 {
		return chunks, nil
	}

	// Create a copy of the chunks to avoid modifying the original
	reRankedChunks := make([]QueryChunk, len(chunks))
	copy(reRankedChunks, chunks)

	// Calculate combined scores for each chunk
	type chunkScore struct {
		index          int
		originalScore  float64
		textSimilarity float64
		keywordMatch   float64
		finalScore     float64
	}

	scores := make([]chunkScore, len(reRankedChunks))

	// Extract keywords from the query
	queryWords := extractKeywords(query)

	// Calculate scores for each chunk
	for i, chunk := range reRankedChunks {
		// Start with the original relevance score (normalized to 0-1 range)
		originalScore := chunk.RelevanceScore
		if originalScore > 1.0 {
			originalScore = 1.0
		}

		// Calculate text similarity between query and chunk
		textSimilarity := similarityScore(query, chunk.Text)

		// Calculate keyword match score
		keywordMatch := calculateKeywordMatchScore(chunk.Text, queryWords)

		// Calculate final score with weights
		// 50% original score, 30% text similarity, 20% keyword match
		finalScore := (0.5 * originalScore) + (0.3 * textSimilarity) + (0.2 * keywordMatch)

		scores[i] = chunkScore{
			index:          i,
			originalScore:  originalScore,
			textSimilarity: textSimilarity,
			keywordMatch:   keywordMatch,
			finalScore:     finalScore,
		}
	}

	// Sort chunks by final score (highest first)
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].finalScore > scores[j].finalScore
	})

	// Create a new slice with re-ranked chunks
	result := make([]QueryChunk, len(reRankedChunks))
	for i, score := range scores {
		result[i] = reRankedChunks[score.index]
		// Update the relevance score to the new calculated score
		result[i].RelevanceScore = score.finalScore
	}

	return result, nil
}

// extractKeywords extracts important keywords from a string
func extractKeywords(text string) []string {
	// Convert to lowercase
	text = strings.ToLower(text)

	// Split into words
	words := strings.Fields(text)

	// Filter out common stop words
	stopWords := map[string]bool{
		"a": true, "an": true, "the": true, "and": true, "or": true, "but": true,
		"is": true, "are": true, "was": true, "were": true, "be": true, "been": true,
		"being": true, "have": true, "has": true, "had": true, "do": true, "does": true,
		"did": true, "to": true, "from": true, "in": true, "out": true, "on": true,
		"off": true, "over": true, "under": true, "again": true, "further": true,
		"then": true, "once": true, "here": true, "there": true, "when": true,
		"where": true, "why": true, "how": true, "all": true, "any": true, "both": true,
		"each": true, "few": true, "more": true, "most": true, "other": true, "some": true,
		"such": true, "no": true, "nor": true, "not": true, "only": true, "own": true,
		"same": true, "so": true, "than": true, "too": true, "very": true, "can": true,
		"will": true, "just": true, "should": true, "now": true, "of": true, "for": true,
		"by": true, "with": true, "about": true, "against": true, "between": true, "into": true,
		"through": true, "during": true, "before": true, "after": true, "above": true,
		"below": true, "up": true, "down": true, "at": true, "this": true, "that": true,
		"these": true, "those": true, "i": true, "you": true, "he": true, "she": true,
		"it": true, "we": true, "they": true, "what": true, "which": true, "who": true,
		"whom": true, "whose": true, "me": true, "him": true, "her": true, "us": true,
		"them": true, "my": true, "your": true, "his": true, "our": true, "their": true,
	}

	var keywords []string
	for _, word := range words {
		// Remove punctuation
		word = strings.Trim(word, ".,;:!?()[]{}\"'`")

		// Skip if empty or a stop word
		if word == "" || stopWords[word] {
			continue
		}

		// Skip if too short (likely not meaningful)
		if len(word) < 3 {
			continue
		}

		keywords = append(keywords, word)
	}

	return keywords
}

// calculateKeywordMatchScore calculates how well a text matches a set of keywords
func calculateKeywordMatchScore(text string, keywords []string) float64 {
	if len(keywords) == 0 {
		return 0
	}

	text = strings.ToLower(text)

	// Count how many keywords are found in the text
	matches := 0
	for _, keyword := range keywords {
		if strings.Contains(text, keyword) {
			matches++
		}
	}

	// Return the proportion of keywords found
	return float64(matches) / float64(len(keywords))
}

// Optimized ProcessMultiTopicRagWithHistory with merged API call flow (2 calls instead of 3)
func ProcessMultiTopicRagWithHistory(ctx context.Context, userUUID, collectionName, userQuery string, topK int, history []models.RagMessage) (QueryResult, error) {
	var combinedResult QueryResult
	combinedResult.Query = userQuery

	utils.LogInfo("🚀 Starting OPTIMIZED dual API call flow (was 3 calls) for query: %s", userQuery)
	startTime := time.Now()

	// Single Call: Merged Classification + Query Expansion
	utils.LogInfo("📋 Single API call: Classification + Query Expansion")
	classificationResult, err := ClassifyAndGenerateQueries(userQuery, history)
	if err != nil {
		utils.LogWarning("Could not classify and generate queries, falling back to simple RAG: %v", err)
		// Fallback to basic single query approach
		result, fallbackErr := QueryCollection(ctx, userUUID, collectionName, userQuery, topK)
		if fallbackErr != nil {
			return combinedResult, fmt.Errorf("both optimized and fallback queries failed: %v, %v", err, fallbackErr)
		}
		combinedResult.RelevantChunks = result.RelevantChunks
		if len(result.RelevantChunks) > 0 {
			answer, answerErr := ProcessRagWithGemini(userQuery, result.RelevantChunks)
			if answerErr == nil {
				combinedResult.Answer = answer
			} else {
				combinedResult.Answer = "Unable to process the query."
			}
		} else {
			combinedResult.Answer = "No relevant information found for your query."
		}
		return combinedResult, nil
	}

	queryType := classificationResult.QueryType
	searchQueries := classificationResult.SearchQueries

	utils.LogInfo("Query classified as: %s (%s)", queryType, classificationResult.Reasoning)

	// Build conversation context for final answer generation with improved formatting
	var contextBuilder strings.Builder

	// Only include the most relevant history (up to 3 most recent exchanges)
	historyToInclude := history
	if len(history) > 6 { // 3 exchanges (user+system) = 6 messages
		historyToInclude = history[len(history)-6:]
		// Add a summary note about older history
		contextBuilder.WriteString("[Note: This conversation has additional history before what's shown below]\n")
	}

	// Format the conversation history in a clear, structured way
	for i, msg := range historyToInclude {
		// Add visual separator between exchanges
		if i > 0 && i%2 == 0 {
			contextBuilder.WriteString("---\n")
		}

		if msg.Role == "user" {
			contextBuilder.WriteString("User: ")
		} else {
			contextBuilder.WriteString("System: ")
		}
		contextBuilder.WriteString(msg.Content)
		contextBuilder.WriteString("\n")
	}
	contextBuilder.WriteString("---\n")
	contextBuilder.WriteString("User: ")
	contextBuilder.WriteString(userQuery)
	contextBuilder.WriteString("\n")

	if queryType == "follow-up" {
		// Call 2: SKIPPED (no RAG needed)
		// Call 3: Final answer generation with conversation context only
		utils.LogInfo("Processing follow-up query with conversation context only.")
		answer, err := ProcessRagWithGeminiWithContext(userQuery, nil, contextBuilder.String())
		if err == nil {
			combinedResult.Answer = answer
		} else {
			utils.LogWarning("Error processing follow-up with Gemini: %v", err)
			combinedResult.Answer = "Unable to process the follow-up query."
		}
		return combinedResult, nil
	}

	// Call 2: Smart RAG Search (for new_topic and combined) - USING PRE-GENERATED QUERIES
	utils.LogInfo("Executing RAG search for query type: %s with %d pre-generated queries", queryType, len(searchQueries))

	// If no queries were generated (shouldn't happen but safety check)
	if len(searchQueries) == 0 {
		utils.LogWarning("No search queries generated, falling back to optimized single query")
		searchQueries, err = OptimizeRagQuery(userQuery)
		if err != nil {
			return combinedResult, fmt.Errorf("failed to generate search queries: %v", err)
		}
	}

	// Determine search options based on query type
	searchOptions := QueryOptions{
		SearchMode:    HybridSearch,
		ReRankResults: true,
	}

	// Adjust keyword boost based on query type
	if queryType == "combined" {
		// For combined queries, give more weight to semantic search
		searchOptions.KeywordBoost = 0.2 // 20% weight to keyword matches
	} else {
		// For new topics, balance semantic and keyword search
		searchOptions.KeywordBoost = 0.4 // 40% weight to keyword matches
	}

	if len(searchQueries) == 0 {
		// Fallback to direct query if no queries generated
		result, err := QueryCollectionWithOptions(ctx, userUUID, collectionName, userQuery, topK, searchOptions)
		if err != nil {
			return combinedResult, fmt.Errorf("failed to query collection: %v", err)
		}
		combinedResult.RelevantChunks = result.RelevantChunks
	} else {
		// Calculate topK for each sub-query, min 3
		subQueryTopK := topK / len(searchQueries)
		if subQueryTopK < 3 {
			subQueryTopK = 3
		}
		if subQueryTopK*len(searchQueries) > topK {
			utils.LogInfo("Adjusted total chunks from %d to %d to ensure minimum of %d chunks per topic", topK, subQueryTopK*len(searchQueries), subQueryTopK)
		}

		// Execute each search query and collect chunks
		var allChunks []QueryChunk
		for i, query := range searchQueries {
			// Alternate between search modes for different queries to maximize coverage
			queryOptions := searchOptions

			// For the first query (usually the original or most important), use hybrid search
			if i == 0 {
				queryOptions.SearchMode = HybridSearch
			} else if i%2 == 1 {
				// For odd-indexed queries, prioritize semantic search
				queryOptions.SearchMode = SemanticSearch
			} else {
				// For even-indexed queries, prioritize keyword search
				queryOptions.SearchMode = KeywordSearch
			}

			result, err := QueryCollectionWithOptions(ctx, userUUID, collectionName, query, subQueryTopK, queryOptions)
			if err != nil {
				utils.LogWarning("Error querying for '%s' with mode %s: %v", query, queryOptions.SearchMode, err)
				continue
			}
			utils.LogInfo("Query '%s' with mode %s returned %d chunks", query, queryOptions.SearchMode, len(result.RelevantChunks))
			allChunks = append(allChunks, result.RelevantChunks...)
		}

		// Remove duplicate chunks and sort by relevance
		uniqueChunks := make([]QueryChunk, 0)
		seen := make(map[string]bool)
		for _, chunk := range allChunks {
			if _, exists := seen[chunk.Text]; !exists {
				seen[chunk.Text] = true
				uniqueChunks = append(uniqueChunks, chunk)
			}
		}

		// Re-rank chunks based on relevance to the original query
		reRankedChunks, err := reRankChunks(uniqueChunks, userQuery)
		if err != nil {
			utils.LogWarning("Error re-ranking chunks: %v, falling back to basic sorting", err)
			// Fallback to basic sorting by relevance score if re-ranking fails
			sort.Slice(uniqueChunks, func(i, j int) bool {
				return uniqueChunks[i].RelevanceScore > uniqueChunks[j].RelevanceScore
			})
			reRankedChunks = uniqueChunks
		}

		// Limit to top chunks if we have too many
		if len(reRankedChunks) > topK {
			reRankedChunks = reRankedChunks[:topK]
		}

		utils.LogInfo("Total chunks after deduplication and re-ranking: %d", len(reRankedChunks))
		combinedResult.RelevantChunks = reRankedChunks
	}

	// Call 2: Final answer generation (optimized from Call 3)
	utils.LogInfo("📝 Generating final answer with %d chunks and conversation context", len(combinedResult.RelevantChunks))
	if len(combinedResult.RelevantChunks) > 0 {
		answer, err := ProcessRagWithGeminiWithContext(userQuery, combinedResult.RelevantChunks, contextBuilder.String())
		if err == nil {
			combinedResult.Answer = answer
		} else {
			utils.LogWarning("Error processing with Gemini: %v", err)
			combinedResult.Answer = "Unable to process the query."
		}
	} else {
		// If no chunks found, still use conversation context
		answer, err := ProcessRagWithGeminiWithContext(userQuery, nil, contextBuilder.String())
		if err == nil {
			combinedResult.Answer = answer
		} else {
			utils.LogWarning("Error processing with conversation context only: %v", err)
			combinedResult.Answer = "No relevant information found for your query."
		}
	}

	// Log optimization metrics
	elapsed := time.Since(startTime)
	utils.LogInfo("✅ OPTIMIZATION COMPLETE: Processed in %v (2 API calls vs previous 3)", elapsed)

	return combinedResult, nil
}

// ProcessRagWithGeminiWithContext sends RAG query results and conversation context to Gemini
func ProcessRagWithGeminiWithContext(query string, chunks []QueryChunk, conversationContext string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("gemini API key not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	// Build prompt with conversation context, query, and relevant chunks
	var promptBuilder strings.Builder
	promptBuilder.WriteString("You are a helpful, conversational AI assistant providing accurate, contextual responses. Your goal is to be informative, engaging, and natural in your interactions.\n\n")

	promptBuilder.WriteString("CONVERSATION HISTORY:\n")
	promptBuilder.WriteString(conversationContext)
	promptBuilder.WriteString("\n")

	promptBuilder.WriteString("CURRENT QUESTION: ")
	promptBuilder.WriteString(query)
	promptBuilder.WriteString("\n\n")

	promptBuilder.WriteString("RELEVANT INFORMATION:\n")
	if len(chunks) > 0 {
		for i, chunk := range chunks {
			promptBuilder.WriteString(fmt.Sprintf("Document %d:\n", i+1))
			promptBuilder.WriteString(chunk.Text)
			if chunk.Metadata != nil {
				source, hasSource := chunk.Metadata["source"].(string)
				if hasSource {
					promptBuilder.WriteString(fmt.Sprintf("\n[Source: %s]", source))
				}
			}
			promptBuilder.WriteString("\n\n")
		}
	} else {
		promptBuilder.WriteString("No specific documents found for this query. Please respond based on the conversation history and your general knowledge.\n\n")
	}

	promptBuilder.WriteString(`INSTRUCTIONS:
1. Provide a conversational, helpful response that directly addresses the user's question
2. Synthesize information from the provided documents and conversation history
3. Maintain a natural, friendly tone as if you're having a casual conversation
4. If the question builds on previous context, acknowledge this connection
5. Present information in a coherent, flowing narrative - avoid listing facts mechanically
6. Use your reasoning to connect concepts and provide insights
7. If information is incomplete, acknowledge limitations while providing your best response
8. Structure your response with a clear introduction, body, and conclusion
9. Cite sources naturally within your response when referencing specific information
10. If you're unsure about something, be honest about your uncertainty

Your response should feel like a natural conversation with a knowledgeable friend rather than a formal report. Be concise but thorough, and focus on being helpful above all else.`)
	contents := []Content{
		{
			Role:  "user",
			Parts: []Part{{Text: promptBuilder.String()}},
		},
	}

	reqBody := GeminiRequest{Contents: contents}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}
