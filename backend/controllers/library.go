package controllers

import (
	"backend/database"
	"backend/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Library returns all media items for the authenticated user along with basic facet counts
// GET /library
func Library(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)

	var media []models.Media
	// Exclude text entries from the library feed
	if err := database.DB.Where("user_uuid = ? AND type <> ?", userUUID, models.MediaText).Order("created_at desc").Find(&media).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Build simple facet counts to help client organize
	counts := fiber.Map{
		"image": 0,
		"video": 0,
		"audio": 0,
	}
	modelCounts := map[string]int{}

	for _, m := range media {
		t := string(m.Type)
		if _, ok := counts[t]; ok { // only image/video/audio present in counts
			counts[t] = counts[t].(int) + 1
		}
		if m.Model != "" {
			modelCounts[m.Model] = modelCounts[m.Model] + 1
		}
	}

	return c.JSON(fiber.Map{
		"items":        media,
		"counts":       counts,
		"model_counts": modelCounts,
	})
}

// LibraryContent returns all library content items for the authenticated user
// GET /library/content
func LibraryContent(c *fiber.Ctx) error {
	userUUID := c.Locals("user_uuid").(uuid.UUID)

	// Get query parameters for filtering
	contentType := c.Query("type")    // e.g., "image", "audio", "video"
	model := c.Query("model")         // e.g., "flux", "sdxl", "music-gen"
	limit := c.QueryInt("limit", 50)  // default to 50 items
	offset := c.QueryInt("offset", 0) // default to 0

	query := database.DB.Where("user_uuid = ?", userUUID)

	if contentType != "" {
		query = query.Where("content_type = ?", contentType)
	}
	if model != "" {
		query = query.Where("model = ?", model)
	}

	var content []models.LibraryContent
	if err := query.Order("created_at desc").Limit(limit).Offset(offset).Find(&content).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Build facet counts using GROUP BY — avoids loading every row
	var totalCount int64
	database.DB.Model(&models.LibraryContent{}).Where("user_uuid = ?", userUUID).Count(&totalCount)

	counts := fiber.Map{
		"image": 0,
		"video": 0,
		"audio": 0,
		"text":  0,
	}
	modelCounts := map[string]int{}

	type facetRow struct {
		ContentType string
		Count       int64
	}
	var typeFacets []facetRow
	database.DB.Model(&models.LibraryContent{}).
		Select("content_type, COUNT(*) as count").
		Where("user_uuid = ?", userUUID).
		Group("content_type").
		Scan(&typeFacets)
	for _, f := range typeFacets {
		if _, ok := counts[f.ContentType]; ok {
			counts[f.ContentType] = int(f.Count)
		}
	}

	type modelFacetRow struct {
		Model string
		Count int64
	}
	var modelFacets []modelFacetRow
	database.DB.Model(&models.LibraryContent{}).
		Select("model, COUNT(*) as count").
		Where("user_uuid = ? AND model != ''", userUUID).
		Group("model").
		Scan(&modelFacets)
	for _, f := range modelFacets {
		modelCounts[f.Model] = int(f.Count)
	}

	return c.JSON(fiber.Map{
		"items":        content,
		"total":        totalCount,
		"counts":       counts,
		"model_counts": modelCounts,
		"pagination": fiber.Map{
			"limit":    limit,
			"offset":   offset,
			"has_more": offset+len(content) < int(totalCount),
		},
	})
}
