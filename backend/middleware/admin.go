package middleware

import (
	"backend/database"
	"backend/models"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

// AdminOnly ensures the user has role=admin
func AdminOnly(c *fiber.Ctx) error {
	auth := c.Get("Authorization")
	userUUID, err := utils.ExtractUserUUIDFromToken(auth)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or missing JWT token"})
	}
	var user models.User
	if err := database.DB.First(&user, "id = ?", userUUID).Error; err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "access denied"})
	}
	if user.Role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "admin only"})
	}
	return c.Next()
}
