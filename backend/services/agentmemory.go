package services

import (
	"backend/database"
	"backend/models"
	"context"
	"time"

	"github.com/google/uuid"
)

const (
	AgentRecencyBufferSize = 10
)

// AgentMemoryService mirrors ChatMemoryService but for AgentConversation/AgentMessage
type AgentMemoryService struct{}

// StoreAgentMessage stores metadata for agent messages (no external RAG calls)
func (ams *AgentMemoryService) StoreAgentMessage(ctx context.Context, agentConvID, userUUID uuid.UUID, messageID uint, content, role string) error {
	msg := models.AgentMessage{
		AgentConversationID: agentConvID,
		Role:                role,
		Content:             content,
		CreatedAt:           time.Now(),
	}
	res := database.DB.Create(&msg)
	if res.Error != nil {
		return res.Error
	}
	return nil
}

// GetRecencyBuffer returns the last N agent messages for context
func (ams *AgentMemoryService) GetRecencyBuffer(agentConvID uuid.UUID, bufferSize int) ([]models.AgentMessage, error) {
	if bufferSize <= 0 {
		bufferSize = AgentRecencyBufferSize
	}
	var messages []models.AgentMessage
	result := database.DB.Where("agent_conversation_id = ?", agentConvID).
		Order("created_at desc").
		Limit(bufferSize).
		Find(&messages)
	if result.Error != nil {
		return nil, result.Error
	}
	// reverse chronological to chronological
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	return messages, nil
}

// BuildAgentConversationContext converts agent messages into Gemini Content format
func (ams *AgentMemoryService) BuildAgentConversationContext(ctx context.Context, agentConvID, userUUID uuid.UUID, currentQuery string) ([]Content, error) {
	var contents []Content
	// Get recency buffer
	recency, err := ams.GetRecencyBuffer(agentConvID, AgentRecencyBufferSize)
	if err == nil && len(recency) > 0 {
		for _, m := range recency {
			role := m.Role
			if role != "user" && role != "model" {
				continue
			}
			contents = append(contents, Content{Role: role, Parts: []Part{{Text: m.Content}}})
		}
	}
	// Add current user query
	contents = append(contents, Content{Role: "user", Parts: []Part{{Text: currentQuery}}})
	return contents, nil
}
