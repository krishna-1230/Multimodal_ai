package middleware

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// CORS restricts cross-origin requests to origins listed in the ALLOWED_ORIGINS
// environment variable (comma-separated). Defaults to http://localhost:3000 for
// local development.
func CORS() fiber.Handler {
	return func(c *fiber.Ctx) error {
		origin := c.Get("Origin")
		if isAllowedOrigin(origin) {
			c.Set("Access-Control-Allow-Origin", origin)
			c.Set("Vary", "Origin")
			c.Set("Access-Control-Allow-Credentials", "true")
		}
		c.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-Requested-With")
		c.Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		if c.Method() == fiber.MethodOptions {
			return c.SendStatus(fiber.StatusNoContent)
		}
		return c.Next()
	}
}

func isAllowedOrigin(origin string) bool {
	if origin == "" {
		return false
	}
	allowed := os.Getenv("ALLOWED_ORIGINS")
	if allowed == "" {
		allowed = "http://localhost:3000"
	}
	for _, o := range strings.Split(allowed, ",") {
		if strings.TrimSpace(o) == origin {
			return true
		}
	}
	return false
}
