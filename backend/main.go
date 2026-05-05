package main

import (
	"backend/database"
	"backend/middleware"
	"backend/models"
	"backend/routes"
	"backend/utils"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/gofiber/fiber/v2"
)

func main() {
	// Initialize loggers
	utils.InitLoggers()
	utils.LogInfo("Starting application...")

	// Load .env early so local development can place JWT_SECRET there
	_ = godotenv.Load(".env")

	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("JWT_SECRET environment variable is not set")
	}

	if err := database.Connect(); err != nil {
		utils.LogError("Failed to connect to database: %v", err)
		log.Fatal("Failed to connect to database: ", err)
	}
	utils.LogInfo("Database connected successfully")

	if err := models.AutoMigrate(database.DB); err != nil {
		utils.LogError("Failed to migrate database: %v", err)
		log.Fatal("Failed to migrate database: ", err)
	}
	utils.LogInfo("Database migrations completed")

	if err := models.MigrateRag(database.DB); err != nil {
		utils.LogError("Failed to migrate RAG models: %v", err)
		log.Fatal("Failed to migrate RAG models: ", err)
	}
	utils.LogInfo("RAG migrations completed")

	// Configure Fiber for large file uploads
	app := fiber.New(fiber.Config{
		BodyLimit:      100 * 1024 * 1024, // 100MB limit
		ReadBufferSize: 64 * 1024,         // 64KB read buffer
	})

	// Global CORS
	app.Use(middleware.CORS())

	// Static serve media directory at /media
	mediaDir := os.Getenv("MEDIA_DIR")
	if mediaDir == "" {
		mediaDir = "./media"
	}
	app.Static("/media", mediaDir)

	// Setup all routes in one call
	routes.SetupRoutes(app)
	utils.LogInfo("Routes initialized")

	port := os.Getenv("PORT")
	if port == "" {
		port = "1234"
	}
	utils.LogInfo("Server starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
