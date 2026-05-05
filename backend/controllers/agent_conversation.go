package controllers

import (
	"backend/database"
	"backend/models"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ListAgentConversations lists agent conversations for the authenticated user
func ListAgentConversations(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	// Use a single query with a subselect to fetch the first message content per conversation (avoids FK relations)
	type Row struct {
		ID        uuid.UUID `json:"id"`
		UserUUID  uuid.UUID `json:"user_uuid"`
		CreatedAt time.Time `json:"created_at"`
		Title     string    `json:"title"`
	}

	var rows []Row
	// Subquery selects the earliest message content for each conversation
	raw := `SELECT ac.id, ac.user_uuid, ac.created_at,
    (SELECT content FROM agent_messages am WHERE am.agent_conversation_id = ac.id ORDER BY am.created_at ASC LIMIT 1) AS title
    FROM agent_conversations ac
    WHERE ac.user_uuid = ?
    ORDER BY ac.created_at DESC`
	if err := database.DB.Raw(raw, userUUID).Scan(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var resp []fiber.Map
	for _, r := range rows {
		resp = append(resp, fiber.Map{"id": r.ID, "user_uuid": r.UserUUID, "created_at": r.CreatedAt, "title": r.Title})
	}
	return c.JSON(resp)
}

// AgentConversationMessages returns messages for a given agent conversation
func AgentConversationMessages(c *fiber.Ctx) error {
	convID := c.Params("agent_conversation_id")
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var conv models.AgentConversation
	if err := database.DB.First(&conv, "id = ?", convID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Agent conversation not found"})
	}
	if conv.UserUUID != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}
	var msgs []models.AgentMessage
	database.DB.Where("agent_conversation_id = ?", convID).Order("created_at asc").Find(&msgs)
	return c.JSON(msgs)
}

// NewAgentConversation creates a new agent conversation and returns its id
func NewAgentConversation(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	convID := uuid.New()
	conv := models.AgentConversation{ID: convID, UserUUID: userUUID, CreatedAt: time.Now()}
	if err := database.DB.Create(&conv).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create conversation"})
	}
	return c.JSON(fiber.Map{"agent_conversation_id": convID.String()})
}
