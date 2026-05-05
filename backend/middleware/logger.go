package middleware

import (
	"github.com/gofiber/fiber/v2"
	fiberlogger "github.com/gofiber/fiber/v2/middleware/logger"
)

// Use Fiber's built-in colorful logger (green 2xx, yellow 4xx, red 5xx)
var defaultLogger = fiberlogger.New()

func LoggerMiddleware(c *fiber.Ctx) error {
	return defaultLogger(c)
}
