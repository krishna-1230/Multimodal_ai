package controllers

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"backend/utils"
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ChatRequest struct {
	ConversationID string `json:"conversation_id"`
	Message        string `json:"message"`
}

type ChatResponse struct {
	Reply          string `json:"reply"`
	ConversationID string `json:"conversation_id"`
}

func Chat(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)

	var req ChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var conv models.Conversation
	var convID uuid.UUID
	var err error

	if req.ConversationID == "" {
		convID = uuid.New()
		conv = models.Conversation{
			ID:        convID,
			UserUUID:  userUUID,
			Title:     req.Message,
			CreatedAt: time.Now(),
		}
		if err := database.DB.Create(&conv).Error; err != nil {
			utils.LogError("Failed to create conversation: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create conversation"})
		}

		// Initialize chat memory buffer for new conversation
		memoryService := &services.ChatMemoryService{}
		err = memoryService.InitializeMemoryBuffer(convID, userUUID)
		if err != nil {
			utils.LogWarning("Failed to initialize memory buffer: %v", err)
			// Don't fail the request if memory buffer initialization fails
		}
	} else {
		convID, err = uuid.Parse(req.ConversationID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid conversation ID"})
		}
		result := database.DB.First(&conv, "id = ?", convID)
		if result.Error != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Conversation not found"})
		}
	}

	// Store user message
	userMsg := models.Message{
		ConversationID: convID,
		Role:           "user",
		Content:        req.Message,
		Timestamp:      time.Now(),
	}
	if err := database.DB.Create(&userMsg).Error; err != nil {
		utils.LogError("Failed to save user message: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save message"})
	}
	userMsgID := userMsg.ID

	// Initialize chat memory service
	memoryService := &services.ChatMemoryService{}

	// Store user message in RAG collection asynchronously (don't block response)
	go func() {
		err := memoryService.StoreChatMessage(context.Background(), convID, userUUID, userMsgID, req.Message, "user")
		if err != nil {
			utils.LogWarning("Failed to store user message in RAG: %v", err)
		}
	}()

	// Check if we should create a summary for this conversation
	shouldSummarize, startMsgID, endMsgID, err := memoryService.ShouldCreateSummary(convID)
	if err == nil && shouldSummarize {
		go func() {
			err := memoryService.CreateConversationSummary(context.Background(), convID, userUUID, startMsgID, endMsgID)
			if err != nil {
				utils.LogWarning("Failed to create conversation summary: %v", err)
			}
		}()
	}

	// Build conversation context using SQL-based recency buffer + summaries only
	ctx := context.Background()
	// Skip RAG retrieval; BuildConversationContext now returns summaries + recency buffer
	contextContents, err := memoryService.BuildConversationContext(ctx, convID, userUUID, req.Message)
	if err != nil {
		utils.LogWarning("Failed to build conversation context: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve conversation history"})
	}

	// Get Gemini reply with enhanced context
	reply, err := services.GetGeminiReplyWithContext(contextContents)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Store AI response
	aiMsg := models.Message{
		ConversationID: convID,
		Role:           "model",
		Content:        reply,
		Timestamp:      time.Now(),
	}
	if err := database.DB.Create(&aiMsg).Error; err != nil {
		utils.LogError("Failed to save AI message: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save response"})
	}
	aiMsgID := aiMsg.ID

	// Store AI message in RAG collection asynchronously
	go func() {
		err := memoryService.StoreChatMessage(context.Background(), convID, userUUID, aiMsgID, reply, "model")
		if err != nil {
			utils.LogWarning("Failed to store AI message in RAG: %v", err)
		}
	}()

	// Update memory buffer timestamp
	err = memoryService.UpdateMemoryBuffer(convID)
	if err != nil {
		utils.LogWarning("Failed to update memory buffer: %v", err)
	}

	return c.JSON(ChatResponse{
		Reply:          reply,
		ConversationID: convID.String(),
	})
}
