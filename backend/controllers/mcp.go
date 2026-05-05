package controllers

import (
	"backend/database"
	"backend/models"
	"backend/utils"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// CreateMCP creates a new MCP entry for the authenticated user
func CreateMCP(c *fiber.Ctx) error {
	// ensure route user_uuid matches the authenticated user
	paramUser := c.Params("user_uuid")
	parsedParamUser, err := uuid.Parse(paramUser)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user_uuid in path"})
	}
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	if parsedParamUser != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}
	var body struct {
		Name      string `json:"name"`
		Endpoint  string `json:"endpoint"`
		AuthToken string `json:"auth_token"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	// basic validation and cleanup
	body.Name = strings.TrimSpace(body.Name)
	body.Endpoint = strings.TrimSpace(body.Endpoint)
	if body.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}
	ep := body.Endpoint
	if !(len(ep) > 0 && (ep[0] == '/' || strings.HasPrefix(ep, "http") || strings.Contains(ep, "://") || strings.Contains(ep, ":"))) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid endpoint"})
	}
	m := models.MCP{
		UserUUID:  userUUID,
		Name:      body.Name,
		Endpoint:  body.Endpoint,
		AuthToken: body.AuthToken,
	}
	if err := database.DB.Create(&m).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(m)
}

// ListMCPs lists all MCPs for the authenticated user
func ListMCPs(c *fiber.Ctx) error {
	// ensure route user_uuid matches the authenticated user
	paramUser := c.Params("user_uuid")
	parsedParamUser, err := uuid.Parse(paramUser)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user_uuid in path"})
	}
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	if parsedParamUser != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}
	var mcps []models.MCP
	database.DB.Where("user_uuid = ?", userUUID).Find(&mcps)

	// sanitize: ensure MCP entries have a name and reasonable endpoint
	var cleaned []models.MCP
	for _, m := range mcps {
		ep := m.Endpoint
		if m.Name == "" {
			utils.LogWarning("ListMCPs: filtered MCP with empty name (id=%s)", m.ID.String())
			continue
		}
		if !(len(ep) > 0 && (ep[0] == '/' || len(ep) > 4 && (ep[:4] == "http" || ep[:5] == "https") || strings.Contains(ep, "://") || strings.Contains(ep, ":"))) {
			utils.LogWarning("ListMCPs: filtered MCP with suspicious endpoint (id=%s endpoint=%s)", m.ID.String(), ep)
			continue
		}
		cleaned = append(cleaned, m)
	}
	return c.JSON(cleaned)
}

// UpdateMCP updates an MCP by id (must belong to user)
func UpdateMCP(c *fiber.Ctx) error {
	// ensure route user_uuid matches the authenticated user
	paramUser := c.Params("user_uuid")
	parsedParamUser, err := uuid.Parse(paramUser)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user_uuid in path"})
	}
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	if parsedParamUser != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}
	id := c.Params("id")
	parsed, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	var m models.MCP
	// Ensure we find the MCP by id string and belonging to the authenticated user
	if err := database.DB.First(&m, "id = ? AND user_uuid = ?", parsed.String(), userUUID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "MCP not found"})
	}
	if m.UserUUID != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}
	var body struct {
		Name      *string `json:"name"`
		Endpoint  *string `json:"endpoint"`
		AuthToken *string `json:"auth_token"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if body.Name != nil {
		m.Name = *body.Name
	}
	if body.Endpoint != nil {
		m.Endpoint = *body.Endpoint
	}
	if body.AuthToken != nil {
		m.AuthToken = *body.AuthToken
	}
	if err := database.DB.Save(&m).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(m)
}

// DeleteMCP deletes an MCP by id (must belong to user)
func DeleteMCP(c *fiber.Ctx) error {
	// ensure route user_uuid matches the authenticated user
	paramUser := c.Params("user_uuid")
	parsedParamUser, err := uuid.Parse(paramUser)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user_uuid in path"})
	}
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	if parsedParamUser != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}
	id := c.Params("id")
	parsed, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	var m models.MCP
	// Ensure we find the MCP by id string and belonging to the authenticated user
	if err := database.DB.First(&m, "id = ? AND user_uuid = ?", parsed.String(), userUUID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "MCP not found"})
	}
	if m.UserUUID != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}
	if err := database.DB.Delete(&m).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "deleted"})
}
