package services

import (
	"backend/database"
	"backend/models"
	"backend/utils"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	RecencyBufferSize      = 10 // Keep last 10 turns (5 user + 5 assistant messages)
	SummarizationThreshold = 20 // Create summary every 20 messages
	MaxRetrievedTurns      = 5  // Maximum number of retrieved turns to include
)

type ChatMemoryService struct{}

// NOTE: EmbeddingRequest/Response removed - now using existing RAG /add_text endpoint

// NOTE: AddTextToRAG removed - now using AddText from ragclient.go

// StoreChatMessage stores a chat message in the RAG collection for this conversation
func (cms *ChatMemoryService) StoreChatMessage(ctx context.Context, conversationID, userUUID uuid.UUID, messageID uint, content, role string) error {
	// Create ChromaDB-compatible collection name (3-63 chars, alphanumeric + underscore + hyphen only)
	collectionName := cms.generateValidCollectionName(userUUID, conversationID)

	// Store the message in RAG collection using existing infrastructure
	_, err := AddText(ctx, content, collectionName, 5)
	if err != nil {
		utils.LogWarning("Failed to store chat message in RAG: %v", err)
		return err
	}

	// Still store metadata in our database for easy access
	chatEmbedding := models.ChatEmbedding{
		ConversationID: conversationID,
		UserUUID:       userUUID,
		MessageID:      messageID,
		Content:        content,
		Role:           role,
		Embedding:      []float64{}, // Empty since we use RAG service
		CreatedAt:      time.Now(),
	}

	result := database.DB.Create(&chatEmbedding)
	if result.Error != nil {
		utils.LogWarning("Failed to store chat message metadata: %v", result.Error)
		return result.Error
	}

	return nil
}

// Legacy method - kept for compatibility but now uses RAG infrastructure
func (cms *ChatMemoryService) StoreMessageEmbedding(ctx context.Context, conversationID, userUUID uuid.UUID, messageID uint, content, role string) error {
	return cms.StoreChatMessage(ctx, conversationID, userUUID, messageID, content, role)
}

// GetRecencyBuffer retrieves the most recent N messages for a conversation
func (cms *ChatMemoryService) GetRecencyBuffer(conversationID uuid.UUID, bufferSize int) ([]models.Message, error) {
	if bufferSize <= 0 {
		bufferSize = RecencyBufferSize
	}

	var messages []models.Message
	result := database.DB.Where("conversation_id = ?", conversationID).
		Order("timestamp desc").
		Limit(bufferSize).
		Find(&messages)

	if result.Error != nil {
		return nil, result.Error
	}

	// Reverse to get chronological order (oldest first)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

// RetrieveRelevantTurns performs semantic search using existing RAG infrastructure
func (cms *ChatMemoryService) RetrieveRelevantTurns(ctx context.Context, conversationID, userUUID uuid.UUID, query string, topK int) ([]models.ChatEmbedding, error) {
	if topK <= 0 {
		topK = MaxRetrievedTurns
	}

	// Create ChromaDB-compatible collection name (same as StoreChatMessage)
	collectionName := cms.generateValidCollectionName(userUUID, conversationID)

	// Query the RAG collection for relevant chat messages
	result, err := QueryCollection(ctx, userUUID.String(), collectionName, query, topK)
	if err != nil {
		utils.LogWarning("Failed to query chat memory from RAG: %v", err)
		return []models.ChatEmbedding{}, err
	}

	if len(result.RelevantChunks) == 0 {
		return []models.ChatEmbedding{}, nil
	}

	// Convert RAG chunks back to ChatEmbedding format
	var relevantEmbeddings []models.ChatEmbedding
	for _, chunk := range result.RelevantChunks {
		// Find the corresponding message in our database
		var chatEmbedding models.ChatEmbedding
		dbResult := database.DB.Where("conversation_id = ? AND content = ?", conversationID, chunk.Text).
			Order("created_at desc").First(&chatEmbedding)

		if dbResult.Error == nil {
			// Update with relevance score from RAG
			chatEmbedding.Embedding = []float64{chunk.RelevanceScore} // Store score
			relevantEmbeddings = append(relevantEmbeddings, chatEmbedding)
		} else {
			// Create a synthetic embedding record if not found
			relevantEmbeddings = append(relevantEmbeddings, models.ChatEmbedding{
				ConversationID: conversationID,
				UserUUID:       userUUID,
				Content:        chunk.Text,
				Role:           "unknown", // We don't know the role from RAG chunk
				Embedding:      []float64{chunk.RelevanceScore},
				CreatedAt:      time.Now(),
			})
		}
	}

	return relevantEmbeddings, nil
}

// NOTE: Cosine similarity calculations removed - now handled by RAG service

// CreateConversationSummary creates a summary of older conversation turns and stores it in RAG
func (cms *ChatMemoryService) CreateConversationSummary(ctx context.Context, conversationID, userUUID uuid.UUID, startMessageID, endMessageID uint) error {
	// Get messages to summarize
	var messages []models.Message
	result := database.DB.Where("conversation_id = ? AND id >= ? AND id <= ?", conversationID, startMessageID, endMessageID).
		Order("timestamp asc").
		Find(&messages)

	if result.Error != nil {
		return result.Error
	}

	if len(messages) == 0 {
		return fmt.Errorf("no messages found to summarize")
	}

	// Build conversation text for summarization
	var conversationText strings.Builder
	conversationText.WriteString("Conversation to summarize:\n")
	for _, msg := range messages {
		role := "User"
		if msg.Role == "model" {
			role = "Assistant"
		}
		conversationText.WriteString(fmt.Sprintf("%s: %s\n", role, msg.Content))
	}

	// Use Gemini to create summary
	prompt := fmt.Sprintf(`Please create a concise summary of the following conversation. Focus on the key points, decisions, and information exchanged. Keep the summary under 200 words.

%s

Summary:`, conversationText.String())

	summary, err := cms.summarizeWithGemini(ctx, prompt)
	if err != nil {
		utils.LogWarning("Failed to generate summary: %v", err)
		return err
	}

	// Store the summary in RAG collection for future retrieval
	collectionName := cms.generateValidCollectionName(userUUID, conversationID)
	summaryText := fmt.Sprintf("CONVERSATION SUMMARY (messages %d-%d): %s", startMessageID, endMessageID, summary)

	_, err = AddText(ctx, summaryText, collectionName, 5)
	if err != nil {
		utils.LogWarning("Failed to store summary in RAG: %v", err)
		// Don't return error - summary is still stored in DB below
	}

	// Store the summary metadata in database
	chatSummary := models.ChatSummary{
		ConversationID: conversationID,
		UserUUID:       userUUID,
		Summary:        summary,
		StartMessageID: startMessageID,
		EndMessageID:   endMessageID,
		CreatedAt:      time.Now(),
	}

	result = database.DB.Create(&chatSummary)
	if result.Error != nil {
		utils.LogWarning("Failed to store conversation summary metadata: %v", result.Error)
		return result.Error
	}

	utils.LogInfo("Created conversation summary for messages %d-%d", startMessageID, endMessageID)
	return nil
}

// summarizeWithGemini uses Gemini to create a conversation summary
func (cms *ChatMemoryService) summarizeWithGemini(ctx context.Context, prompt string) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("gemini API key not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey

	contents := []Content{
		{
			Role:  "user",
			Parts: []Part{{Text: prompt}},
		},
	}

	reqBody := GeminiRequest{Contents: contents}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini summary API error (%d): %s", resp.StatusCode, string(bodyBytes))
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

// GetConversationSummaries retrieves all summaries for a conversation
func (cms *ChatMemoryService) GetConversationSummaries(conversationID uuid.UUID) ([]models.ChatSummary, error) {
	var summaries []models.ChatSummary
	result := database.DB.Where("conversation_id = ?", conversationID).
		Order("created_at asc").
		Find(&summaries)

	if result.Error != nil {
		return nil, result.Error
	}

	return summaries, nil
}

// BuildConversationContext assembles the final context for Gemini using the hybrid approach
func (cms *ChatMemoryService) BuildConversationContext(ctx context.Context, conversationID, userUUID uuid.UUID, currentQuery string) ([]Content, error) {
	var contextContents []Content

	// Step A: Get conversation summaries (older history)
	summaries, err := cms.GetConversationSummaries(conversationID)
	if err == nil && len(summaries) > 0 {
		var summaryText strings.Builder
		summaryText.WriteString("Previous conversation summaries:\n")
		for i, summary := range summaries {
			summaryText.WriteString(fmt.Sprintf("%d. %s\n", i+1, summary.Summary))
		}

		contextContents = append(contextContents, Content{
			Role:  "user",
			Parts: []Part{{Text: summaryText.String()}},
		})
	}

	// Step B: (removed) - semantic RAG retrieval disabled for chat context.
	// We rely on conversation summaries + recency buffer (SQL) for context.

	// Step C: Get recency buffer (immediate context)
	recencyMessages, err := cms.GetRecencyBuffer(conversationID, RecencyBufferSize)
	if err == nil && len(recencyMessages) > 0 {
		for _, msg := range recencyMessages {
			role := msg.Role
			if role == "ai" {
				role = "model" // normalize old value
			}
			if role != "user" && role != "model" {
				continue // skip invalid roles
			}
			contextContents = append(contextContents, Content{
				Role:  role,
				Parts: []Part{{Text: msg.Content}},
			})
		}
	}

	// Step D: Add current user query
	contextContents = append(contextContents, Content{
		Role:  "user",
		Parts: []Part{{Text: currentQuery}},
	})

	return contextContents, nil
}

// ShouldCreateSummary checks if a conversation should have a new summary created
func (cms *ChatMemoryService) ShouldCreateSummary(conversationID uuid.UUID) (bool, uint, uint, error) {
	var messageCount int64
	result := database.DB.Model(&models.Message{}).Where("conversation_id = ?", conversationID).Count(&messageCount)
	if result.Error != nil {
		return false, 0, 0, result.Error
	}

	if messageCount < SummarizationThreshold {
		return false, 0, 0, nil
	}

	// Get the last summary's end message ID
	var lastSummary models.ChatSummary
	result = database.DB.Where("conversation_id = ?", conversationID).
		Order("end_message_id desc").
		First(&lastSummary)

	var startMessageID uint = 1 // Start from beginning if no summaries exist
	if result.Error == nil {
		startMessageID = lastSummary.EndMessageID + 1
	}

	// Get the current maximum message ID
	var maxMessage models.Message
	result = database.DB.Where("conversation_id = ?", conversationID).
		Order("id desc").
		First(&maxMessage)

	if result.Error != nil {
		return false, 0, 0, result.Error
	}

	// Check if we have enough new messages for a summary
	newMessageCount := maxMessage.ID - startMessageID + 1
	if newMessageCount >= SummarizationThreshold {
		return true, startMessageID, maxMessage.ID, nil
	}

	return false, 0, 0, nil
}

// InitializeMemoryBuffer initializes the memory buffer for a conversation
func (cms *ChatMemoryService) InitializeMemoryBuffer(conversationID, userUUID uuid.UUID) error {
	buffer := models.ChatMemoryBuffer{
		ConversationID: conversationID,
		UserUUID:       userUUID,
		BufferSize:     RecencyBufferSize,
		LastUpdated:    time.Now(),
	}

	result := database.DB.Create(&buffer)
	if result.Error != nil {
		// Ignore if already exists
		if strings.Contains(result.Error.Error(), "duplicate") {
			return nil
		}
		return result.Error
	}

	return nil
}

// UpdateMemoryBuffer updates the last updated timestamp for a conversation's memory buffer
func (cms *ChatMemoryService) UpdateMemoryBuffer(conversationID uuid.UUID) error {
	result := database.DB.Model(&models.ChatMemoryBuffer{}).
		Where("conversation_id = ?", conversationID).
		Update("last_updated", time.Now())

	return result.Error
}

// generateValidCollectionName creates a ChromaDB-compatible collection name
// ChromaDB rules: 3-63 chars, alphanumeric + underscore + hyphen, no consecutive periods
func (cms *ChatMemoryService) generateValidCollectionName(userUUID, conversationID uuid.UUID) string {
	// Take first 8 chars of each UUID and combine
	userPart := userUUID.String()[:8]
	convPart := conversationID.String()[:8]

	// Create format: chat_{user}_{conv}
	collectionName := fmt.Sprintf("chat_%s_%s", userPart, convPart)

	// Ensure it meets ChromaDB requirements:
	// - 3-63 characters ✓ (will be ~20 chars)
	// - Starts/ends with alphanumeric ✓
	// - Only alphanumeric, underscore, hyphen ✓
	// - No consecutive periods ✓
	// - Not IPv4 address ✓

	return collectionName
}

// GetMemoryBuffer retrieves the memory buffer configuration for a conversation
func (cms *ChatMemoryService) GetMemoryBuffer(conversationID uuid.UUID) (*models.ChatMemoryBuffer, error) {
	var buffer models.ChatMemoryBuffer
	result := database.DB.Where("conversation_id = ?", conversationID).First(&buffer)
	if result.Error != nil {
		return nil, result.Error
	}
	return &buffer, nil
}
