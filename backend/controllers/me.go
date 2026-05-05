package controllers

import (
	"backend/database"
	"backend/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GET /me returns current user details from JWT
func Me(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var user models.User
	if err := database.DB.First(&user, "id = ?", userUUID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}
	return c.JSON(fiber.Map{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
		"role":     user.Role,
	})
}
