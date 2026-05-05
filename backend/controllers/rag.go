package controllers

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"backend/utils"
	"context"
	"io"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func Upload(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	collectionName := c.FormValue("collection_name")
	_, err := c.FormFile("files")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No files uploaded"})
	}
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid multipart form"})
	}
	fileHeaders := form.File["files"]
	var readers []io.Reader
	var filenames []string
	for _, fh := range fileHeaders {
		f, err := fh.Open()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to open file"})
		}
		defer f.Close()
		readers = append(readers, f)
		filenames = append(filenames, fh.Filename)
	}
	ctx := context.Background()
	result, err := services.UploadFiles(ctx, userUUID.String(), collectionName, readers, filenames)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	// Store metadata in DB
	for _, r := range result.Results {
		doc := models.RagDocument{
			CollectionName: userUUID.String() + "_" + collectionName,
			Filename:       r.Filename,
			UploadedAt:     time.Now(),
		}
		database.DB.Create(&doc)
	}
	database.DB.FirstOrCreate(&models.RagCollection{}, models.RagCollection{
		UserUUID:       userUUID,
		CollectionName: collectionName,
		CreatedAt:      time.Now(),
	})
	return c.JSON(result)
}

func Query(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	type reqBody struct {
		Query          string  `json:"query"`
		CollectionName string  `json:"collection_name"`
		TopK           int     `json:"top_k"`
		ConversationID *string `json:"conversation_id"` // optional
	}
	var req reqBody
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	ctx := context.Background()
	utils.LogInfo("RAG query: %s on collection %s", req.Query, req.CollectionName)

	// Conversation management
	var conversationID uuid.UUID
	if req.ConversationID != nil && *req.ConversationID != "" {
		parsed, err := uuid.Parse(*req.ConversationID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid conversation_id"})
		}
		conversationID = parsed
	} else {
		conversationID = uuid.New()
		// Create new conversation in DB
		conv := models.RagConversation{
			ID:             conversationID,
			UserUUID:       userUUID,
			CollectionName: req.CollectionName,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		}
		database.DB.Create(&conv)
	}

	// Store user message
	userMsg := models.RagMessage{
		ID:                uuid.New(),
		RagConversationID: conversationID,
		Role:              "user",
		Content:           req.Query,
		CreatedAt:         time.Now(),
	}
	database.DB.Create(&userMsg)

	// Fetch last 5 messages (excluding this one)
	var history []models.RagMessage
	database.DB.Where("rag_conversation_id = ?", conversationID).
		Order("created_at desc").
		Limit(4).
		Find(&history)

	// Reverse to chronological order
	for i, j := 0, len(history)-1; i < j; i, j = i+1, j-1 {
		history[i], history[j] = history[j], history[i]
	}

	// Use the multi-topic RAG processing with history
	result, err := services.ProcessMultiTopicRagWithHistory(ctx, userUUID.String(), req.CollectionName, req.Query, req.TopK, history)
	if err != nil {
		utils.LogError("RAG query failed: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Store system answer
	answerMsg := models.RagMessage{
		ID:                uuid.New(),
		RagConversationID: conversationID,
		Role:              "system",
		Content:           result.Answer,
		CreatedAt:         time.Now(),
	}
	database.DB.Create(&answerMsg)

	// Return the answer and conversation_id
	return c.JSON(fiber.Map{"answer": result.Answer, "conversation_id": conversationID.String()})
}

// Speech-based RAG: accepts transcript and behaves like Query
func SpeechRag(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	type reqBody struct {
		Transcript     string  `json:"transcript"`
		CollectionName string  `json:"collection_name"`
		TopK           int     `json:"top_k"`
		ConversationID *string `json:"conversation_id"`
	}
	var req reqBody
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	ctx := context.Background()
	utils.LogInfo("RAG speech query: %s on collection %s", req.Transcript, req.CollectionName)

	// Conversation management
	var conversationID uuid.UUID
	if req.ConversationID != nil && *req.ConversationID != "" {
		parsed, err := uuid.Parse(*req.ConversationID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid conversation_id"})
		}
		conversationID = parsed
	} else {
		conversationID = uuid.New()
		conv := models.RagConversation{
			ID:             conversationID,
			UserUUID:       userUUID,
			CollectionName: req.CollectionName,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		}
		database.DB.Create(&conv)
	}

	// Store user message
	userMsg := models.RagMessage{
		ID:                uuid.New(),
		RagConversationID: conversationID,
		Role:              "user",
		Content:           req.Transcript,
		CreatedAt:         time.Now(),
	}
	database.DB.Create(&userMsg)

	// Fetch last 4 messages
	var history []models.RagMessage
	database.DB.Where("rag_conversation_id = ?", conversationID).
		Order("created_at desc").
		Limit(4).
		Find(&history)

	for i, j := 0, len(history)-1; i < j; i, j = i+1, j-1 {
		history[i], history[j] = history[j], history[i]
	}

	result, err := services.ProcessMultiTopicRagWithHistory(ctx, userUUID.String(), req.CollectionName, req.Transcript, req.TopK, history)
	if err != nil {
		utils.LogError("RAG speech failed: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Store system answer
	answerMsg := models.RagMessage{
		ID:                uuid.New(),
		RagConversationID: conversationID,
		Role:              "system",
		Content:           result.Answer,
		CreatedAt:         time.Now(),
	}
	database.DB.Create(&answerMsg)

	return c.JSON(fiber.Map{"answer": result.Answer, "conversation_id": conversationID.String()})
}

func ListCollections(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	ctx := context.Background()
	collections, err := services.ListCollections(ctx, userUUID.String())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"collections": collections})
}

func DeleteCollection(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	collectionName := c.Params("collection_name")
	ctx := context.Background()
	if err := services.DeleteCollection(ctx, userUUID.String(), collectionName); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	database.DB.Where("collection_name = ?", userUUID.String()+"_"+collectionName).Delete(&models.RagDocument{})
	database.DB.Where("user_uuid = ? AND collection_name = ?", userUUID, collectionName).Delete(&models.RagCollection{})
	return c.JSON(fiber.Map{"message": "Collection '" + userUUID.String() + "_" + collectionName + "' deleted successfully"})
}

// ListRagConversations returns all RAG conversations for a user, with preview/title
func ListRagConversations(c *fiber.Ctx) error {
	// Enforce that the user can only list their own conversations
	paramUUID := c.Params("user_uuid")
	authUUID := c.Locals("user_uuid").(uuid.UUID)
	if paramUUID != authUUID.String() {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}
	var conversations []models.RagConversation
	db := database.DB.Preload("Messages").Where("user_uuid = ?", authUUID).Order("created_at desc")
	db.Find(&conversations)

	// Build response with preview/title (first user message)
	var resp []fiber.Map
	for _, conv := range conversations {
		title := ""
		for _, msg := range conv.Messages {
			if msg.Role == "user" {
				title = msg.Content
				break
			}
		}
		resp = append(resp, fiber.Map{
			"id":              conv.ID,
			"user_uuid":       conv.UserUUID,
			"collection_name": conv.CollectionName,
			"created_at":      conv.CreatedAt,
			"updated_at":      conv.UpdatedAt,
			"title":           title,
		})
	}
	return c.JSON(resp)
}

// AddText adds text content to a RAG collection
func AddText(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)

	type reqBody struct {
		Text           string `json:"text"`
		CollectionName string `json:"collection_name"`
		TopK           int    `json:"top_k"`
	}

	var req reqBody
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Text == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Text content is required"})
	}

	if req.TopK == 0 {
		req.TopK = 5
	}

	ctx := context.Background()
	utils.LogInfo("Adding text to RAG collection: %s (user: %s)", req.CollectionName, userUUID.String())

	result, err := services.AddText(ctx, req.Text, userUUID.String()+"_"+req.CollectionName, req.TopK)
	if err != nil {
		utils.LogError("Failed to add text to RAG: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Store metadata in DB
	doc := models.RagDocument{
		CollectionName: userUUID.String() + "_" + req.CollectionName,
		Filename:       "text_content", // Generic filename for text content
		UploadedAt:     time.Now(),
	}
	database.DB.Create(&doc)

	// Ensure collection exists
	database.DB.FirstOrCreate(&models.RagCollection{}, models.RagCollection{
		UserUUID:       userUUID,
		CollectionName: req.CollectionName,
		CreatedAt:      time.Now(),
	})

	return c.JSON(result)
}

// RagConversationMessages returns the full message history for a RAG conversation
func RagConversationMessages(c *fiber.Ctx) error {
	conversationID := c.Params("conversation_id")
	var messages []models.RagMessage
	database.DB.Where("rag_conversation_id = ?", conversationID).Order("created_at asc").Find(&messages)
	return c.JSON(messages)
}
