# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.18.0
FROM node:${NODE_VERSION}-alpine

# Set working directory inside the container
WORKDIR /app

# Copy only package.json & lock first
COPY package*.json ./

# Install all dependencies (including dev for development)
RUN npm install

# Copy rest of the project
COPY . .

# Expose Next.js dev server port
EXPOSE 3000

# Start in development mode (hot reload)
CMD ["npm", "run", "dev"]
