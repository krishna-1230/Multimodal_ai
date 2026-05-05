package controllers

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"backend/utils"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type SpeechRequest struct {
	ConversationID string `json:"conversation_id"`
	Transcript     string `json:"transcript"`
}

type SpeechResponse struct {
	Reply          string `json:"reply"`
	ConversationID string `json:"conversation_id"`
}

// POST /speech
func Speech(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)

	var req SpeechRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var conv models.Conversation
	var convID uuid.UUID
	var err error

	if req.ConversationID == "" {
		convID = uuid.New()
		title := req.Transcript
		if len(title) > 80 {
			title = title[:80]
		}
		conv = models.Conversation{
			ID:        convID,
			UserUUID:  userUUID,
			Title:     title,
			CreatedAt: time.Now(),
		}
		if err := database.DB.Create(&conv).Error; err != nil {
			utils.LogError("Failed to create conversation: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create conversation"})
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

	userMsg := models.Message{
		ConversationID: convID,
		Role:           "user",
		Content:        req.Transcript,
		Timestamp:      time.Now(),
	}
	database.DB.Create(&userMsg)

	var messages []models.Message
	database.DB.Where("conversation_id = ?", convID).Order("timestamp desc").Limit(10).Find(&messages)

	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	reply, err := services.GetGeminiReply(messages)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	aiMsg := models.Message{
		ConversationID: convID,
		Role:           "model",
		Content:        reply,
		Timestamp:      time.Now(),
	}
	database.DB.Create(&aiMsg)

	return c.JSON(SpeechResponse{
		Reply:          reply,
		ConversationID: convID.String(),
	})
}
