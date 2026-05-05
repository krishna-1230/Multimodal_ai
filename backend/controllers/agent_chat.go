package controllers

import (
	"backend/database"
	"backend/models"
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// POST /agent-chat -> create an AgentChat, call Gemini to craft a workflow prompt, forward to n8n, save outputs
func CreateAgentChat(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	// Support either JSON or multipart/form-data (with files)
	var prompt string
	var contextStr string
	// Capture multipart form upfront to avoid using Fiber context inside goroutine
	var capturedForm *multipart.Form
	var formHasFiles bool
	if f, err := c.MultipartForm(); err == nil && f != nil {
		capturedForm = f
		if len(f.File) > 0 {
			formHasFiles = true
		}
		if vs, ok := f.Value["prompt"]; ok && len(vs) > 0 {
			prompt = vs[0]
		}
		if vs, ok := f.Value["context"]; ok && len(vs) > 0 {
			contextStr = vs[0]
		}
	} else {
		var body struct {
			Prompt  string `json:"prompt"`
			Context string `json:"context"` // optional serialized past conversation
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
		}
		prompt = body.Prompt
		contextStr = body.Context
	}

	// parse agent_conversation_id (if any) from form or json for later use
	var convIDStr string
	if capturedForm != nil {
		if vs, ok := capturedForm.Value["agent_conversation_id"]; ok && len(vs) > 0 {
			convIDStr = vs[0]
		}
	} else {
		var probe struct {
			AgentConversationID string `json:"agent_conversation_id"`
		}
		_ = c.BodyParser(&probe)
		convIDStr = probe.AgentConversationID
	}

	// create AgentChat record
	ac := models.AgentChat{
		UUID:      uuid.New(),
		UserUUID:  userUUID,
		Prompt:    prompt,
		Context:   contextStr,
		Status:    "created",
		Provider:  "local",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	database.DB.Create(&ac)

	// Determine agent conversation: if provided use it, otherwise create a new one (same behavior as chat)
	var agentConvUUID uuid.UUID
	if convIDStr != "" {
		if parsed, err := uuid.Parse(convIDStr); err == nil {
			agentConvUUID = parsed
			// ensure conversation exists
			var conv models.AgentConversation
			if database.DB.First(&conv, "id = ?", agentConvUUID).Error != nil {
				conv = models.AgentConversation{ID: agentConvUUID, UserUUID: userUUID, Title: prompt, CreatedAt: time.Now()}
				database.DB.Create(&conv)
			}
		}
	} else {
		// create a new agent conversation
		newConvID := uuid.New()
		agentConvUUID = newConvID
		conv := models.AgentConversation{ID: agentConvUUID, UserUUID: userUUID, Title: prompt, CreatedAt: time.Now()}
		database.DB.Create(&conv)
	}

	// store user message in agent messages table
	if agentConvUUID != uuid.Nil {
		database.DB.Create(&models.AgentMessage{AgentConversationID: agentConvUUID, Role: "user", Content: prompt, CreatedAt: time.Now()})
	}

	// Prepare the external processing as a reusable function so we can run it async or sync
	processAgent := func(agentChatID uint, promptText, contextText string, convUUID uuid.UUID, user uuid.UUID, multipartAvailable bool, captured *multipart.Form) error {
		n8nURL := "http://localhost:5678/webhook/master"
		var respLocal *http.Response
		var errLocal error

		if multipartAvailable && captured != nil && len(captured.File) > 0 {
			buf := &bytes.Buffer{}
			w := multipart.NewWriter(buf)
			_ = w.WriteField("prompt", promptText)
			_ = w.WriteField("userid", user.String())
			imageCount := 0
			for _, fhs := range captured.File {
				for _, fh := range fhs {
					if imageCount >= 2 {
						break
					}
					src, err := fh.Open()
					if err != nil {
						continue
					}
					part, _ := w.CreateFormFile("image", fh.Filename)
					io.Copy(part, src)
					src.Close()
					imageCount++
				}
				if imageCount >= 2 {
					break
				}
			}
			w.Close()
			req, _ := http.NewRequest("POST", n8nURL, buf)
			req.Header.Set("Content-Type", w.FormDataContentType())
			respLocal, errLocal = http.DefaultClient.Do(req)
		} else {
			n8nPayload := map[string]interface{}{"prompt": promptText, "userid": user.String()}
			b, _ := json.Marshal(n8nPayload)
			respLocal, errLocal = http.Post(n8nURL, "application/json", bytes.NewReader(b))
		}
		if errLocal != nil {
			// mark error
			var a models.AgentChat
			database.DB.First(&a, "id = ?", agentChatID)
			a.Status = "n8n_error"
			database.DB.Save(&a)
			return errLocal
		}
		defer respLocal.Body.Close()
		dataLocal, _ := io.ReadAll(respLocal.Body)

		// parse and save outputs
		var parsed interface{}
		if json.Unmarshal(dataLocal, &parsed) == nil {
			if mediaOutputs := extractAgentMediaOutputs(parsed); len(mediaOutputs) > 0 {
				saveAgentOutputs(agentChatID, mediaOutputs, user, promptText, respLocal.Status, convUUID)
			} else {
				saveAgentRawOutput(agentChatID, string(dataLocal), convUUID)
			}
		} else {
			saveAgentRawOutput(agentChatID, string(dataLocal), convUUID)
		}

		var a models.AgentChat
		database.DB.First(&a, "id = ?", agentChatID)
		a.Status = "completed"
		database.DB.Save(&a)
		return nil
	}

	// If caller requested synchronous processing (e.g., ?sync=1 or header X-WAIT-FOR-OUTPUT: 1) run inline and return outputs
	syncRequested := c.Query("sync") == "1" || c.Get("X-WAIT-FOR-OUTPUT") == "1" || c.Get("X-WAIT") == "1"
	if syncRequested {
		// run the processor inline (blocks until n8n/Gemini complete)
		if err := processAgent(ac.ID, prompt, contextStr, agentConvUUID, userUUID, formHasFiles, capturedForm); err != nil {
			var a models.AgentChat
			database.DB.First(&a, "id = ?", ac.ID)
			a.Status = "n8n_error"
			database.DB.Save(&a)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		// fetch outputs to return them in response
		var outs []models.AgentChatOutput
		database.DB.Where("agent_chat_id = ?", ac.ID).Order("created_at desc").Find(&outs)
		return c.JSON(fiber.Map{"agent_chat_id": ac.ID, "agent_conversation_id": agentConvUUID.String(), "outputs": outs})
	}

	// Default: run in background and return immediately
	go func() {
		_ = processAgent(ac.ID, prompt, contextStr, agentConvUUID, userUUID, formHasFiles, capturedForm)
	}()

	// Respond immediately
	return c.JSON(fiber.Map{"agent_chat_id": ac.ID, "agent_conversation_id": agentConvUUID.String()})
}

func saveAgentRawOutput(agentChatID uint, raw string, agentConvUUID uuid.UUID) {
	database.DB.Create(&models.AgentChatOutput{AgentChatID: agentChatID, Type: "text", Content: raw, Provider: "n8n", CreatedAt: time.Now()})
	if agentConvUUID != uuid.Nil {
		database.DB.Create(&models.AgentMessage{AgentConversationID: agentConvUUID, Role: "model", Content: raw, CreatedAt: time.Now()})
	}
}

func extractAgentMediaOutputs(value interface{}) []interface{} {
	var outputs []interface{}
	seen := map[string]bool{}
	var walk func(interface{}, []string)
	walk = func(node interface{}, path []string) {
		switch current := node.(type) {
		case map[string]interface{}:
			if out, ok := buildAgentMediaOutput(current, path); ok {
				urlStr := toString(out["url"])
				if urlStr != "" && !seen[urlStr] {
					seen[urlStr] = true
					outputs = append(outputs, out)
				}
			}
			for key, child := range current {
				walk(child, append(path, key))
			}
		case []interface{}:
			for _, child := range current {
				walk(child, path)
			}
		}
	}
	walk(value, nil)
	return outputs
}

func buildAgentMediaOutput(m map[string]interface{}, path []string) (map[string]interface{}, bool) {
	urlStr := toString(m["url"])
	if urlStr == "" || shouldIgnoreAgentMediaPath(path) {
		return nil, false
	}
	mimeType := toString(m["mime_type"])
	if mimeType == "" {
		mimeType = toString(m["mime"])
	}
	isImage, _ := m["is_image"].(bool)
	outputType := inferAgentOutputType(mimeType, isImage, urlStr)
	if outputType == "unknown" {
		return nil, false
	}
	content := toString(m["visible_name"])
	if content == "" {
		content = toString(m["name"])
	}
	return map[string]interface{}{
		"type":    outputType,
		"url":     urlStr,
		"mime":    mimeType,
		"content": content,
	}, true
}

func shouldIgnoreAgentMediaPath(path []string) bool {
	for _, part := range path {
		lower := strings.ToLower(part)
		if strings.Contains(lower, "thumbnail") || strings.Contains(lower, "thumb") || strings.HasPrefix(lower, "input") {
			return true
		}
	}
	return false
}

func inferAgentOutputType(mimeType string, isImage bool, urlStr string) string {
	lowerMime := strings.ToLower(mimeType)
	lowerURL := strings.ToLower(urlStr)
	switch {
	case isImage || strings.HasPrefix(lowerMime, "image/") || strings.Contains(lowerURL, ".png") || strings.Contains(lowerURL, ".jpg") || strings.Contains(lowerURL, ".jpeg") || strings.Contains(lowerURL, ".webp") || strings.Contains(lowerURL, ".gif"):
		return "image"
	case strings.HasPrefix(lowerMime, "video/") || strings.Contains(lowerURL, ".mp4") || strings.Contains(lowerURL, ".webm") || strings.Contains(lowerURL, ".mov"):
		return "video"
	case strings.HasPrefix(lowerMime, "audio/") || strings.Contains(lowerURL, ".mp3") || strings.Contains(lowerURL, ".wav"):
		return "audio"
	case strings.Contains(lowerMime, "pdf") || strings.Contains(lowerURL, ".pdf"):
		return "doc"
	default:
		return "unknown"
	}
}

func saveAgentOutputs(agentChatID uint, arr []interface{}, userUUID uuid.UUID, originalPrompt string, status string, agentConvUUID uuid.UUID) {
	for _, it := range arr {
		if m, ok := it.(map[string]interface{}); ok {
			// normalize common text keys into `content` so saveAgentSingleOutput can persist it
			if _, hasContent := m["content"]; !hasContent {
				// check common aliases
				keys := []string{"output", "text", "message", "result", "body", "response"}
				for _, k := range keys {
					if v, ok2 := m[k]; ok2 {
						switch vv := v.(type) {
						case string:
							if strings.TrimSpace(vv) != "" {
								m = map[string]interface{}{"type": "text", "content": vv}
								ok = true
							}
						default:
							if b, err := json.Marshal(vv); err == nil {
								s := strings.TrimSpace(string(b))
								if s != "" && s != "null" {
									m = map[string]interface{}{"type": "text", "content": s}
									ok = true
								}
							}
						}
						if ok {
							break
						}
					}
				}
			}
			saveAgentSingleOutput(agentChatID, m, userUUID, originalPrompt, status, agentConvUUID)
		} else if s, ok := it.(string); ok {
			database.DB.Create(&models.AgentChatOutput{AgentChatID: agentChatID, Type: "text", Content: s, Provider: "n8n", CreatedAt: time.Now()})
			if agentConvUUID != uuid.Nil {
				// store model text as agent message
				database.DB.Create(&models.AgentMessage{AgentConversationID: agentConvUUID, Role: "model", Content: s, CreatedAt: time.Now()})
			}
		}
	}
}

func saveAgentSingleOutput(agentChatID uint, m map[string]interface{}, userUUID uuid.UUID, originalPrompt string, status string, agentConvUUID uuid.UUID) {
	// expected fields: type, url, mime, content
	typ := "unknown"
	if v, ok := m["type"].(string); ok && v != "" {
		typ = v
	} else if _, ok := m["url"]; ok {
		typ = "file"
	} else if _, ok := m["content"]; ok {
		typ = "text"
	}
	urlStr := ""
	if u, ok := m["url"].(string); ok {
		urlStr = u
	}
	mime := ""
	if mm, ok := m["mime"].(string); ok {
		mime = mm
	} else if mm, ok := m["mime_type"].(string); ok {
		mime = mm
	}
	content := ""
	if c, ok := m["content"].(string); ok {
		content = c
	} else if c, ok := m["visible_name"].(string); ok {
		content = c
	} else if c, ok := m["name"].(string); ok {
		content = c
	}
	if typ == "unknown" || typ == "file" {
		isImage, _ := m["is_image"].(bool)
		if inferred := inferAgentOutputType(mime, isImage, urlStr); inferred != "unknown" {
			typ = inferred
		}
	}
	out := models.AgentChatOutput{AgentChatID: agentChatID, Type: typ, URL: urlStr, MimeType: mime, Content: content, Provider: "n8n", CreatedAt: time.Now()}
	database.DB.Create(&out)
	if agentConvUUID != uuid.Nil {
		// save as agent message (model)
		display := content
		if display == "" {
			display = urlStr
		}
		database.DB.Create(&models.AgentMessage{AgentConversationID: agentConvUUID, Role: "model", Content: display, CreatedAt: time.Now()})
	}

	// If this output looks like a downloadable media URL, save to Media + Library
	if urlStr != "" && (strings.HasPrefix(urlStr, "http") || strings.HasPrefix(urlStr, "/media/")) {
		// If it's a full http URL, attempt to download and save using existing helpers
		if strings.HasPrefix(urlStr, "http") {
			if pub, loc, mm, err := downloadToUser(userUUID, urlStr, "agent"); err == nil {
				// choose media type based on mime
				mediaType := models.MediaImage
				if strings.Contains(mm, "video") {
					mediaType = models.MediaVideo
				} else if strings.Contains(mm, "audio") {
					mediaType = models.MediaAudio
				}
				database.DB.Create(&models.Media{UserUUID: userUUID, Type: mediaType, Model: "agent", Variant: "agent-output", Prompt: originalPrompt, URL: pub, LocalPath: loc, MimeType: mm, Provider: "n8n", Status: status, CreatedAt: time.Now()})
				// Save to library
				saveToLibrary(userUUID, string(mediaType), "agent", "agent-output", originalPrompt, pub, mm, "n8n")
			}
		} else {
			// local /media path - create media row referencing it
			database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaImage, Model: "agent", Variant: "agent-output", Prompt: originalPrompt, URL: urlStr, LocalPath: urlStr, MimeType: mime, Provider: "n8n", Status: "saved", CreatedAt: time.Now()})
			saveToLibrary(userUUID, "image", "agent", "agent-output", originalPrompt, urlStr, mime, "n8n")
		}
	}
}

// GET /agent-chat/:id/outputs -> list outputs for an agent chat
func ListAgentChatOutputs(c *fiber.Ctx) error {
	id := c.Params("id")
	var outputs []models.AgentChatOutput
	database.DB.Where("agent_chat_id = ?", id).Order("created_at desc").Find(&outputs)
	return c.JSON(outputs)
}
