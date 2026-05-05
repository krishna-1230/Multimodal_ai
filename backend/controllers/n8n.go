package controllers

import (
	"backend/database"
	"backend/models"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Helper function to save content to library
func saveToLibrary(userUUID uuid.UUID, contentType, model, variant, prompt, directURL, mimeType, provider string) {
	// Generate a title from the prompt (first 50 chars)
	title := prompt
	if len(title) > 50 {
		title = title[:50] + "..."
	}
	if title == "" {
		title = "Generated " + contentType
	}

	libraryContent := models.LibraryContent{
		UserUUID:    userUUID,
		ContentType: contentType,
		Model:       model,
		Variant:     variant,
		Title:       title,
		Prompt:      prompt,
		DirectURL:   directURL,
		MimeType:    mimeType,
		Provider:    provider,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	database.DB.Create(&libraryContent)
}

// Helper function to extract and save URL from response to library
func extractAndSaveToLibrary(data []byte, userUUID uuid.UUID, contentType, model, variant, prompt, provider string) {
	var parsed map[string]interface{}
	if json.Unmarshal(data, &parsed) == nil {
		// Try to get direct URL from different possible fields
		var directURL string
		var mimeType string

		if imgURL := toString(parsed["img"]); imgURL != "" {
			// Clean URL for image responses
			directURL = strings.TrimSpace(strings.TrimPrefix(imgURL, ","))
			mimeType = "image/png" // default for images
		} else if videoURL := toString(parsed["video"]); videoURL != "" {
			// Clean URL for video responses
			directURL = strings.TrimSpace(strings.TrimPrefix(videoURL, ","))
			mimeType = "video/mp4" // default for videos
		} else if audioURL := toString(parsed["audio"]); audioURL != "" {
			// Clean URL for audio responses
			directURL = strings.TrimSpace(strings.TrimPrefix(audioURL, ","))
			mimeType = "audio/mpeg" // default for audio
		} else if urlStr := toString(parsed["url"]); urlStr != "" {
			// General URL field
			directURL = strings.TrimSpace(urlStr)
			// Determine mime type based on content type
			switch contentType {
			case "image":
				mimeType = "image/png"
			case "audio":
				mimeType = "audio/mpeg"
			case "video":
				mimeType = "video/mp4"
			default:
				mimeType = "application/octet-stream"
			}
		}

		if directURL != "" {
			saveToLibrary(userUUID, contentType, model, variant, prompt, directURL, mimeType, provider)
		}
	}
}

func normalizeFluxVariant(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "normal", "fast":
		return "normal"
	case "realism", "fast-realism":
		return "realism"
	default:
		return "normal"
	}
}

func normalizeFluxKontextVariant(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "quality", "fast":
		return "quality"
	default:
		return "quality"
	}
}

// base URL for n8n, e.g. http://localhost:5678
func n8nBaseURL() string {
	if v := os.Getenv("N8N_BASE_URL"); v != "" {
		return v
	}
	return "http://localhost:5678"
}

func forwardJSON(path string, payload map[string]interface{}) (*http.Response, error) {
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", strings.TrimRight(n8nBaseURL(), "/")+path, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return http.DefaultClient.Do(req)
}

// --- Local media saving helpers ---
func mediaBaseDir() string {
	if v := os.Getenv("MEDIA_DIR"); v != "" {
		return v
	}
	return "./media"
}

func ensureDir(path string) error {
	return os.MkdirAll(path, 0o755)
}

func guessExtFromContentType(ct string) string {
	ct = strings.ToLower(ct)
	switch {
	case strings.Contains(ct, "image/png"):
		return ".png"
	case strings.Contains(ct, "image/jpeg"):
		return ".jpg"
	case strings.Contains(ct, "image/webp"):
		return ".webp"
	case strings.Contains(ct, "video/mp4"):
		return ".mp4"
	case strings.Contains(ct, "video/webm"):
		return ".webm"
	case strings.Contains(ct, "audio/mpeg") || strings.Contains(ct, "audio/mp3"):
		return ".mp3"
	case strings.Contains(ct, "audio/wav"):
		return ".wav"
	default:
		return ""
	}
}

func saveBytesForUser(userUUID uuid.UUID, data []byte, suggestedExt string, contentType string, prefix string) (publicURL, localPath, mime string, err error) {
	base := mediaBaseDir()
	now := time.Now()
	relDir := filepath.Join(userUUID.String(), now.Format("2006"), now.Format("01"), now.Format("02"))
	if err = ensureDir(filepath.Join(base, relDir)); err != nil {
		return "", "", "", err
	}
	ext := suggestedExt
	if ext == "" && contentType != "" {
		ext = guessExtFromContentType(contentType)
	}
	if ext == "" {
		ext = ".bin"
	}
	name := prefix + "-" + uuid.New().String() + ext
	localPath = filepath.Join(base, relDir, name)
	if err = os.WriteFile(localPath, data, 0o644); err != nil {
		return "", "", "", err
	}
	publicURL = "/media/" + filepath.ToSlash(filepath.Join(relDir, name))
	return publicURL, localPath, contentType, nil
}

func downloadToUser(userUUID uuid.UUID, urlStr string, prefix string) (publicURL, localPath, mime string, err error) {
	resp, err := http.Get(urlStr)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", err
	}
	ct := resp.Header.Get("Content-Type")
	return saveBytesForUser(userUUID, b, "", ct, prefix)
}

func downloadBytes(urlStr string) (data []byte, contentType string, err error) {
	resp, err := http.Get(urlStr)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	data, err = io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	return data, resp.Header.Get("Content-Type"), nil
}

func isAllowedMediaProxyHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == "" {
		return false
	}
	allowed := []string{"localhost", "127.0.0.1", "host.docker.internal", "::1"}
	if env := os.Getenv("MEDIA_PROXY_ALLOWED_HOSTS"); env != "" {
		allowed = nil
		for _, item := range strings.Split(env, ",") {
			trimmed := strings.ToLower(strings.TrimSpace(item))
			if trimmed != "" {
				allowed = append(allowed, trimmed)
			}
		}
	}
	for _, item := range allowed {
		if host == item {
			return true
		}
	}
	return false
}

// GET /media/proxy?url=http://host.docker.internal:85/...
// Streams a restricted set of local/docker-host media URLs through the backend
// so remote clients can access them via the backend tunnel.
func MediaProxy(c *fiber.Ctx) error {
	rawURL := strings.TrimSpace(c.Query("url"))
	if rawURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing url"})
	}

	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme == "" || parsed.Hostname() == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid url"})
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unsupported scheme"})
	}
	if !isAllowedMediaProxyHost(parsed.Hostname()) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "host not allowed"})
	}

	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "upstream unavailable"})
	}
	defer resp.Body.Close()

	if ct := resp.Header.Get("Content-Type"); ct != "" {
		c.Set("Content-Type", ct)
	}
	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		c.Set("Content-Disposition", cd)
	}
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		c.Set("Content-Length", cl)
	}
	if cc := resp.Header.Get("Cache-Control"); cc != "" {
		c.Set("Cache-Control", cc)
	} else {
		c.Set("Cache-Control", "public, max-age=300")
	}

	c.Status(resp.StatusCode)
	_, err = io.Copy(c.Response().BodyWriter(), resp.Body)
	return err
}

// POST /integrations/deep-research
func DeepResearch(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	resp, err := forwardJSON("/webhook/deep-research", body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "n8n unavailable"})
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	// Try saving if response includes a URL or base64 payload, otherwise just log text
	var parsed map[string]interface{}
	saved := false
	if json.Unmarshal(data, &parsed) == nil {
		if filePayload, ok := parsed["file"].(map[string]interface{}); ok {
			downloadURL := toString(filePayload["downloadUrl"])
			filename := filepath.Base(toString(filePayload["name"]))
			if downloadURL != "" {
				raw, contentType, err := downloadBytes(downloadURL)
				if err == nil {
					ext := filepath.Ext(filename)
					if contentType == "" && ext != "" {
						contentType = mime.TypeByExtension(ext)
					}
					if pub, loc, savedMime, err := saveBytesForUser(userUUID, raw, ext, contentType, "deep-research"); err == nil {
						if savedMime == "" {
							savedMime = contentType
						}
						database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaText, Model: "deep-research", Variant: "default", Prompt: toString(body["Search Topic"]), URL: pub, LocalPath: loc, MimeType: savedMime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
						saveToLibrary(userUUID, "text", "deep-research", "default", toString(body["Search Topic"]), pub, savedMime, "n8n")
						saved = true
						if savedMime != "" {
							c.Set("Content-Type", savedMime)
						}
						if filename != "" {
							c.Set("Content-Disposition", "inline; filename=\""+filename+"\"")
						}
						return c.Status(resp.StatusCode).SendFile(loc)
					}
				}
			}
		} else if urlStr := toString(parsed["url"]); urlStr != "" {
			if pub, loc, mime, err := downloadToUser(userUUID, urlStr, "deep-research"); err == nil {
				database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaText, Model: "deep-research", Variant: "default", Prompt: toString(body["Search Topic"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
				saveToLibrary(userUUID, "text", "deep-research", "default", toString(body["Search Topic"]), pub, mime, "n8n")
				saved = true
			}
		} else if b64 := toString(parsed["base64"]); b64 != "" {
			if raw, err := base64.StdEncoding.DecodeString(b64); err == nil {
				if pub, loc, mime, err := saveBytesForUser(userUUID, raw, "", "text/plain", "deep-research"); err == nil {
					database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaText, Model: "deep-research", Variant: "default", Prompt: toString(body["Search Topic"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
					saveToLibrary(userUUID, "text", "deep-research", "default", toString(body["Search Topic"]), pub, mime, "n8n")
					saved = true
				}
			}
		}
	}
	if !saved {
		database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaText, Model: "deep-research", Variant: "default", Prompt: toString(body["Search Topic"]), Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
	}
	return c.Status(resp.StatusCode).Send(data)
}

// POST /integrations/sdxl
func SDXL(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	resp, err := forwardJSON("/webhook/sdxl", body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "n8n unavailable"})
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	// Try to parse to capture URL or base64
	var parsed map[string]interface{}
	if json.Unmarshal(data, &parsed) == nil {
		if urlStr := toString(parsed["url"]); urlStr != "" {
			if pub, loc, mime, err := downloadToUser(userUUID, urlStr, "sdxl"); err == nil {
				database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaImage, Model: toString(body["model"]), Variant: "sdxl", Prompt: toString(body["prompt"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
			}
		} else if b64 := toString(parsed["base64"]); b64 != "" {
			if raw, err := base64.StdEncoding.DecodeString(b64); err == nil {
				if pub, loc, mime, err := saveBytesForUser(userUUID, raw, ".png", "image/png", "sdxl"); err == nil {
					database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaImage, Model: toString(body["model"]), Variant: "sdxl", Prompt: toString(body["prompt"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
				}
			}
		}
	}
	// Save to library
	extractAndSaveToLibrary(data, userUUID, "image", "sdxl", toString(body["model"]), toString(body["prompt"]), "n8n")

	return c.Status(resp.StatusCode).Send(data)
}

// POST /integrations/flux
func Flux(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	modelVariant := normalizeFluxVariant(toString(body["model"]))
	body["model"] = modelVariant
	resp, err := forwardJSON("/webhook/flux", body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "n8n unavailable"})
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var parsed map[string]interface{}
	if json.Unmarshal(data, &parsed) == nil {
		if urlStr := toString(parsed["url"]); urlStr != "" {
			if pub, loc, mime, err := downloadToUser(userUUID, urlStr, "flux"); err == nil {
				database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaImage, Model: "flux", Variant: modelVariant, Prompt: toString(body["prompt"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
			}
		} else if b64 := toString(parsed["base64"]); b64 != "" {
			if raw, err := base64.StdEncoding.DecodeString(b64); err == nil {
				if pub, loc, mime, err := saveBytesForUser(userUUID, raw, ".png", "image/png", "flux"); err == nil {
					database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaImage, Model: "flux", Variant: modelVariant, Prompt: toString(body["prompt"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
				}
			}
		}
	}
	// Save to library
	extractAndSaveToLibrary(data, userUUID, "image", "flux", modelVariant, toString(body["prompt"]), "n8n")

	return c.Status(resp.StatusCode).Send(data)
}

// POST /integrations/music-gen
func MusicGen(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	resp, err := forwardJSON("/webhook/music-gen", body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "n8n unavailable"})
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var parsed map[string]interface{}
	if json.Unmarshal(data, &parsed) == nil {
		if urlStr := toString(parsed["url"]); urlStr != "" {
			if pub, loc, mime, err := downloadToUser(userUUID, urlStr, "music"); err == nil {
				database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaAudio, Model: "music-gen", Variant: toString(body["tags"]), Prompt: toString(body["lyrics"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
			}
		} else if b64 := toString(parsed["base64"]); b64 != "" {
			if raw, err := base64.StdEncoding.DecodeString(b64); err == nil {
				if pub, loc, mime, err := saveBytesForUser(userUUID, raw, ".mp3", "audio/mpeg", "music"); err == nil {
					database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaAudio, Model: "music-gen", Variant: toString(body["tags"]), Prompt: toString(body["lyrics"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
				}
			}
		}
	}
	// Save to library
	extractAndSaveToLibrary(data, userUUID, "audio", "music-gen", toString(body["tags"]), toString(body["lyrics"]), "n8n")

	return c.Status(resp.StatusCode).Send(data)
}

// POST /integrations/fluxkontext-1 (multipart form)
func FluxContextOne(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid form"})
	}
	modelVariant := normalizeFluxKontextVariant(first(form.Value["model"]))
	buf := &bytes.Buffer{}
	w := multipart.NewWriter(buf)
	// copy fields
	for key, vals := range form.Value {
		if key == "model" {
			_ = w.WriteField(key, modelVariant)
			continue
		}
		for _, v := range vals {
			_ = w.WriteField(key, v)
		}
	}
	// copy files
	for _, fhs := range form.File {
		for _, fh := range fhs {
			src, err := fh.Open()
			if err != nil {
				continue
			}
			defer src.Close()
			part, _ := w.CreateFormFile("image", fh.Filename)
			io.Copy(part, src)
		}
	}
	w.Close()
	req, _ := http.NewRequest("POST", strings.TrimRight(n8nBaseURL(), "/")+"/webhook/fluxkontext-1", buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	// No auth required for n8n
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "n8n unavailable"})
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var parsed map[string]interface{}
	kontextVariant := "kontext-1-" + modelVariant
	if json.Unmarshal(data, &parsed) == nil {
		if urlStr := toString(parsed["url"]); urlStr != "" {
			if pub, loc, mime, err := downloadToUser(userUUID, urlStr, "flux1"); err == nil {
				database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaImage, Model: "flux", Variant: kontextVariant, Prompt: first(form.Value["prompt"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
			}
		} else if b64 := toString(parsed["base64"]); b64 != "" {
			if raw, err := base64.StdEncoding.DecodeString(b64); err == nil {
				if pub, loc, mime, err := saveBytesForUser(userUUID, raw, ".png", "image/png", "flux1"); err == nil {
					database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaImage, Model: "flux", Variant: kontextVariant, Prompt: first(form.Value["prompt"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
				}
			}
		}
	}
	// Save to library
	extractAndSaveToLibrary(data, userUUID, "image", "flux", kontextVariant, first(form.Value["prompt"]), "n8n")

	return c.Status(resp.StatusCode).Send(data)
}

// POST /integrations/fluxkontext-2 (multipart form, multiple images)
func FluxContextTwo(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid form"})
	}
	modelVariant := normalizeFluxKontextVariant(first(form.Value["model"]))
	buf := &bytes.Buffer{}
	w := multipart.NewWriter(buf)
	// copy fields
	for key, vals := range form.Value {
		if key == "model" {
			_ = w.WriteField(key, modelVariant)
			continue
		}
		for _, v := range vals {
			_ = w.WriteField(key, v)
		}
	}
	// copy files
	for key, fhs := range form.File {
		for _, fh := range fhs {
			src, err := fh.Open()
			if err != nil {
				continue
			}
			defer src.Close()
			part, _ := w.CreateFormFile(key, fh.Filename)
			io.Copy(part, src)
		}
	}
	w.Close()
	req, _ := http.NewRequest("POST", strings.TrimRight(n8nBaseURL(), "/")+"/webhook/fluxkontext-2", buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	// No auth required for n8n
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "n8n unavailable"})
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var parsed map[string]interface{}
	kontextVariant := "kontext-2-" + modelVariant
	if json.Unmarshal(data, &parsed) == nil {
		if urlStr := toString(parsed["url"]); urlStr != "" {
			if pub, loc, mime, err := downloadToUser(userUUID, urlStr, "flux2"); err == nil {
				database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaImage, Model: "flux", Variant: kontextVariant, Prompt: first(form.Value["prompt"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
			}
		} else if b64 := toString(parsed["base64"]); b64 != "" {
			if raw, err := base64.StdEncoding.DecodeString(b64); err == nil {
				if pub, loc, mime, err := saveBytesForUser(userUUID, raw, ".png", "image/png", "flux2"); err == nil {
					database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaImage, Model: "flux", Variant: kontextVariant, Prompt: first(form.Value["prompt"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
				}
			}
		}
	}
	// Save to library
	extractAndSaveToLibrary(data, userUUID, "image", "flux", kontextVariant, first(form.Value["prompt"]), "n8n")

	return c.Status(resp.StatusCode).Send(data)
}

// POST /integrations/video-gen
func VideoGen(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	resp, err := forwardJSON("/webhook/video-gen", body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "n8n unavailable"})
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var parsed map[string]interface{}
	if json.Unmarshal(data, &parsed) == nil {
		// Try to get video URL from different possible fields
		var videoURL string
		if videoStr := toString(parsed["video"]); videoStr != "" {
			videoURL = videoStr
		} else if urlStr := toString(parsed["url"]); urlStr != "" {
			videoURL = urlStr
		}

		if videoURL != "" {
			// Clean the URL
			cleanURL := strings.TrimSpace(strings.TrimPrefix(videoURL, ","))
			if pub, loc, mime, err := downloadToUser(userUUID, cleanURL, "video"); err == nil {
				database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaVideo, Model: toString(body["model"]), Variant: "video-gen", Prompt: toString(body["script"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
			}
		}
	}
	// Save to library
	extractAndSaveToLibrary(data, userUUID, "video", "video-gen", toString(body["model"]), toString(body["script"]), "n8n")

	return c.Status(resp.StatusCode).Send(data)
}

// POST /integrations/voice-gen
func VoiceGen(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	resp, err := forwardJSON("/webhook/voice-gen", body)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "n8n unavailable"})
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var parsed map[string]interface{}
	if json.Unmarshal(data, &parsed) == nil {
		if urlStr := toString(parsed["url"]); urlStr != "" {
			if pub, loc, mime, err := downloadToUser(userUUID, urlStr, "voice"); err == nil {
				database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaAudio, Model: toString(body["TTS voice"]), Variant: "voice-gen", Prompt: toString(body["script"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
			}
		} else if b64 := toString(parsed["base64"]); b64 != "" {
			if raw, err := base64.StdEncoding.DecodeString(b64); err == nil {
				if pub, loc, mime, err := saveBytesForUser(userUUID, raw, ".mp3", "audio/mpeg", "voice"); err == nil {
					database.DB.Create(&models.Media{UserUUID: userUUID, Type: models.MediaAudio, Model: toString(body["TTS voice"]), Variant: "voice-gen", Prompt: toString(body["script"]), URL: pub, LocalPath: loc, MimeType: mime, Provider: "n8n", Status: resp.Status, CreatedAt: time.Now()})
				}
			}
		}
	}
	// Save to library (use voice_type field for variant)
	voiceVariant := toString(body["voice_type"])
	if voiceVariant == "" {
		voiceVariant = toString(body["TTS voice"]) // fallback for old requests
	}
	extractAndSaveToLibrary(data, userUUID, "audio", "voice-gen", voiceVariant, toString(body["script"]), "n8n")

	return c.Status(resp.StatusCode).Send(data)
}

// GET /media (list with filters)
func ListMedia(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)
	var media []models.Media
	q := database.DB.Where("user_uuid = ?", userUUID)
	if t := c.Query("type"); t != "" {
		q = q.Where("type = ?", t)
	}
	if m := c.Query("model"); m != "" {
		q = q.Where("model = ?", m)
	}
	if v := c.Query("variant"); v != "" {
		q = q.Where("variant = ?", v)
	}
	q.Order("created_at desc").Find(&media)
	return c.JSON(media)
}

// Admin stats endpoints
// GET /admin/stats/overview
func AdminOverview(c *fiber.Ctx) error {
	// basic aggregates
	var users int64
	database.DB.Model(&models.User{}).Count(&users)
	var mediaCount int64
	database.DB.Model(&models.Media{}).Count(&mediaCount)
	var imageCount int64
	database.DB.Model(&models.Media{}).Where("type = ?", models.MediaImage).Count(&imageCount)
	var videoCount int64
	database.DB.Model(&models.Media{}).Where("type = ?", models.MediaVideo).Count(&videoCount)
	var audioCount int64
	database.DB.Model(&models.Media{}).Where("type = ?", models.MediaAudio).Count(&audioCount)
	var textCount int64
	database.DB.Model(&models.Media{}).Where("type = ?", models.MediaText).Count(&textCount)
	return c.JSON(fiber.Map{
		"users":       users,
		"media_total": mediaCount,
		"by_type": fiber.Map{
			"image": imageCount,
			"video": videoCount,
			"audio": audioCount,
			"text":  textCount,
		},
	})
}

// GET /admin/stats/top-models
func AdminTopModels(c *fiber.Ctx) error {
	type Row struct {
		Model string
		C     int64
	}
	rows, err := database.DB.Model(&models.Media{}).Select("model, COUNT(*) as c").Group("model").Order("c desc").Rows()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var results []fiber.Map
	for rows.Next() {
		var r Row
		if err := database.DB.ScanRows(rows, &r); err == nil {
			results = append(results, fiber.Map{"model": r.Model, "count": r.C})
		}
	}
	return c.JSON(results)
}

// GET /admin/stats/daily
func AdminDaily(c *fiber.Ctx) error {
	// group by day created_at
	type Row struct {
		Day string
		C   int64
	}
	rows, err := database.DB.Model(&models.Media{}).Select("DATE(created_at) as day, COUNT(*) as c").Group("day").Order("day asc").Rows()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()
	var results []fiber.Map
	for rows.Next() {
		var r Row
		if err := database.DB.ScanRows(rows, &r); err == nil {
			results = append(results, fiber.Map{"day": r.Day, "count": r.C})
		}
	}
	return c.JSON(results)
}

// helpers
func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	default:
		b, _ := json.Marshal(t)
		return strings.TrimSpace(string(b))
	}
}

func first(vals []string) string {
	if len(vals) == 0 {
		return ""
	}
	return vals[0]
}

// Optional: a simple file proxy if n8n gives local file paths; we can serve files under /media/files?path=...
func MediaFileProxy(c *fiber.Ctx) error {
	p := c.Query("path")
	if p == "" {
		return c.Status(400).SendString("missing path")
	}
	// basic safety: only allow under a configured dir
	base := os.Getenv("MEDIA_DIR")
	if base == "" {
		base = "."
	}
	cleaned := filepath.Clean(p)
	if !strings.HasPrefix(cleaned, filepath.Clean(base)) {
		return c.Status(403).SendString("forbidden")
	}
	return c.SendFile(cleaned)
}
