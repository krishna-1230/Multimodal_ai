package middleware

import (
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

func JWTMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	userUUID, err := utils.ExtractUserUUIDFromToken(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or missing JWT token"})
	}
	c.Locals("user_uuid", userUUID)
	return c.Next()
}
