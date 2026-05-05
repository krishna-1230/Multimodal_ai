package utils

import (
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func GetJWTSecret() []byte {
	return []byte(os.Getenv("JWT_SECRET"))
}

func GenerateJWT(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"exp":     jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(GetJWTSecret())
}

func ExtractUserUUIDFromToken(authHeader string) (uuid.UUID, error) {
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return uuid.Nil, jwt.ErrTokenMalformed
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		return GetJWTSecret(), nil
	})
	if err != nil || !token.Valid {
		return uuid.Nil, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, jwt.ErrTokenMalformed
	}
	userID, ok := claims["user_id"].(string)
	if !ok {
		return uuid.Nil, jwt.ErrTokenMalformed
	}
	return uuid.Parse(userID)
}
