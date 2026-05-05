package routes

import (
	"backend/controllers"
	"backend/middleware"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

// SetupRoutes registers all application routes
func SetupRoutes(app *fiber.App) {
	// Apply logger middleware to all routes
	app.Use(middleware.LoggerMiddleware)

	// Auth routes — rate-limited to 10 requests per minute
	authLimiter := limiter.New(limiter.Config{Max: 10, Expiration: 1 * time.Minute})
	app.Post("/signup", authLimiter, controllers.Signup)
	app.Post("/login", authLimiter, controllers.Login)
	app.Get("/me", middleware.JWTMiddleware, controllers.Me)

	// Chat routes (with JWT middleware)
	app.Post("/chat", middleware.JWTMiddleware, controllers.Chat)
	// Speech (transcription) route
	app.Post("/speech", middleware.JWTMiddleware, controllers.Speech)

	// Conversation routes (with JWT middleware)
	app.Post("/conversations/new", middleware.JWTMiddleware, controllers.NewConversation)
	app.Get("/conversations/:user_uuid", middleware.JWTMiddleware, controllers.ListConversations)
	app.Get("/conversations/:conversation_id/messages", middleware.JWTMiddleware, controllers.ConversationMessages)

	// RAG routes (with JWT middleware)
	app.Post("/rag/upload", middleware.JWTMiddleware, controllers.Upload)
	app.Post("/rag/query", middleware.JWTMiddleware, controllers.Query)
	app.Post("/rag/speech", middleware.JWTMiddleware, controllers.SpeechRag)
	app.Post("/rag/add_text", middleware.JWTMiddleware, controllers.AddText)
	app.Get("/rag/collections", middleware.JWTMiddleware, controllers.ListCollections)
	app.Delete("/rag/collections/:collection_name", middleware.JWTMiddleware, controllers.DeleteCollection)

	// New: RAG conversation listing and history
	app.Get("/rag/conversations/:user_uuid", middleware.JWTMiddleware, controllers.ListRagConversations)
	app.Get("/rag/conversations/:conversation_id/messages", middleware.JWTMiddleware, controllers.RagConversationMessages)

	// N8N integrations (with JWT middleware)
	grp := app.Group("/integrations", middleware.JWTMiddleware)
	grp.Post("/deep-research", controllers.DeepResearch)
	grp.Post("/sdxl", controllers.SDXL)
	grp.Post("/flux", controllers.Flux)
	grp.Post("/music-gen", controllers.MusicGen)
	grp.Post("/fluxkontext-1", controllers.FluxContextOne)
	grp.Post("/fluxkontext-2", controllers.FluxContextTwo)
	grp.Post("/video-gen", controllers.VideoGen)
	grp.Post("/voice-gen", controllers.VoiceGen)

	// Agent Chat endpoints (with JWT middleware)
	agent := app.Group("/agent-chat", middleware.JWTMiddleware)
	agent.Post("/", controllers.CreateAgentChat)
	agent.Get("/:id/outputs", controllers.ListAgentChatOutputs)

	// AgentConversation endpoints
	agentConv := app.Group("/agent-conversations", middleware.JWTMiddleware)
	agentConv.Post("/new", controllers.NewAgentConversation)
	agentConv.Get("/:user_uuid", controllers.ListAgentConversations)
	agentConv.Get("/:agent_conversation_id/messages", controllers.AgentConversationMessages)

	// Library routes
	app.Get("/library/content", middleware.JWTMiddleware, controllers.LibraryContent)

	// Media listing and static proxy
	app.Get("/media", middleware.JWTMiddleware, controllers.ListMedia)
	app.Get("/media/proxy", controllers.MediaProxy)
	// Library (organized media feed)
	app.Get("/library", middleware.JWTMiddleware, controllers.Library)
	// app.Get("/media/files", controllers.MediaFileProxy) // no longer needed with app.Static

	// Admin stats
	admin := app.Group("/admin", middleware.AdminOnly)
	admin.Get("/stats/overview", controllers.AdminOverview)
	admin.Get("/stats/top-models", controllers.AdminTopModels)
	admin.Get("/stats/daily", controllers.AdminDaily)

	// MCP endpoints (per-user)
	mcp := app.Group("/users/:user_uuid/mcps", middleware.JWTMiddleware)
	mcp.Post("/", controllers.CreateMCP)
	mcp.Get("/", controllers.ListMCPs)
	mcp.Put("/:id", controllers.UpdateMCP)
	mcp.Delete("/:id", controllers.DeleteMCP)
}
