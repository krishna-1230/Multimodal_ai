package controllers

import (
	"backend/database"
	"backend/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func ListConversations(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var conversations []models.Conversation
	database.DB.Where("user_uuid = ?", userUUID).Order("created_at desc").Find(&conversations)

	// For each conversation, fetch the first user message as title/preview
	var resp []fiber.Map
	for _, conv := range conversations {
		var firstUserMsg models.Message
		database.DB.Where("conversation_id = ? AND role = ?", conv.ID, "user").Order("timestamp asc").First(&firstUserMsg)
		title := firstUserMsg.Content
		resp = append(resp, fiber.Map{
			"id":         conv.ID,
			"user_uuid":  conv.UserUUID,
			"created_at": conv.CreatedAt,
			"title":      title,
		})
	}
	return c.JSON(resp)
}

func ConversationMessages(c *fiber.Ctx) error {
	convID := c.Params("conversation_id")
	// Ensure the requester owns this conversation
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var conv models.Conversation
	if err := database.DB.First(&conv, "id = ?", convID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Conversation not found"})
	}
	if conv.UserUUID != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}
	var messages []models.Message
	database.DB.Where("conversation_id = ?", convID).Order("timestamp asc").Find(&messages)
	return c.JSON(messages)
}

func NewConversation(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	convID := uuid.New()
	conv := models.Conversation{
		ID:       convID,
		UserUUID: userUUID,
	}
	if err := database.DB.Create(&conv).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create conversation"})
	}
	return c.JSON(fiber.Map{"conversation_id": convID.String()})
}
