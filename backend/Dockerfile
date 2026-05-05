# syntax=docker/dockerfile:1

FROM golang:1.24.1 AS dev

# Install Air (live reload for Go)
RUN go install github.com/air-verse/air@latest

WORKDIR /app

# Cache deps
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Expose your backend port
EXPOSE 1234

# Default command: run with Air
CMD ["air", "-c", ".air.toml"]
