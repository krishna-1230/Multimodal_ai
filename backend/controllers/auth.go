package controllers

import (
	"backend/database"
	"backend/models"
	"backend/utils"
	"strings"

	"github.com/gofiber/fiber/v2"
)

type SignupInput struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Signup(c *fiber.Ctx) error {
	var input SignupInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	input.Username = strings.TrimSpace(input.Username)
	input.Email = strings.TrimSpace(input.Email)
	if len(input.Username) < 3 || len(input.Username) > 50 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Username must be 3–50 characters"})
	}
	if !strings.Contains(input.Email, "@") || len(input.Email) > 254 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid email address"})
	}
	if len(input.Password) < 8 || len(input.Password) > 128 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Password must be 8–128 characters"})
	}
	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to hash password"})
	}
	user := models.User{Username: input.Username, Email: input.Email, Password: hashedPassword}
	if err := database.DB.Create(&user).Error; err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") || strings.Contains(err.Error(), "UNIQUE constraint") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Email or username already registered"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create account"})
	}
	token, err := utils.GenerateJWT(user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}
	return c.JSON(fiber.Map{"message": "Signup successful", "token": token})
}

func Login(c *fiber.Ctx) error {
	var input LoginInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	var user models.User
	if err := database.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid email or password"})
	}
	if !utils.CheckPasswordHash(input.Password, user.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid email or password"})
	}
	token, err := utils.GenerateJWT(user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}
	return c.JSON(fiber.Map{"token": token})
}
