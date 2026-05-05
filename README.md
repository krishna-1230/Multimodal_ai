# Multimodal AI Project

A comprehensive microservices architecture project featuring an AI-powered chat platform with RAG (Retrieval-Augmented Generation) capabilities, document processing, and Notion integration.

## 🏗️ Architecture Overview

This project implements a modern microservices architecture with the following components:

- **Backend API** - Go-based REST API with JWT authentication and MySQL database
- **Frontend** - Next.js 15 application with glassmorphism UI and real-time chat
- **RAG/Chroma Services** - Python-based retrieval-augmented generation using ChromaDB and LangChain
- **Document Parser** - Multi-format document conversion services (PDF, DOCX, PPTX)
- **Notion MCP** - Model Context Protocol server for Notion API integration

## 📋 Features

### Backend API
- RESTful API built with Fiber framework
- JWT-based authentication system
- MySQL database with GORM ORM
- File upload handling (up to 100MB)
- CORS middleware for cross-origin requests
- RAG model migrations and management
- Media file serving

### Frontend Application
- Premium dark-themed UI with glassmorphism effects
- Real-time AI chat interface
- RAG-powered document assistant
- Media gallery for generated content
- User authentication and session management
- Markdown support with syntax highlighting
- Responsive design for all devices

### RAG/Chroma Services
- ChromaDB vector database integration
- LangChain for document processing
- Google Generative AI integration
- Sentence transformers for embeddings
- PDF, DOCX document parsing
- GPU and CPU acceleration support
- Graph RAG capabilities

### Document Parser
- HTML to PDF conversion
- Structured content to DOCX conversion
- PowerPoint (PPTX) generation
- RESTful API endpoints for all conversions

### Notion MCP
- Full Notion API integration
- User and workspace management
- Page and database operations
- Block content manipulation
- Search and query capabilities
- Comment system integration

## 🛠️ Tech Stack

### Backend
- **Language**: Go 1.24.1
- **Framework**: Fiber v2.52.8
- **Database**: MySQL with GORM
- **Authentication**: JWT (golang-jwt/jwt/v5)
- **Config**: godotenv

### Frontend
- **Framework**: Next.js 15.4.6
- **Language**: React 19.1.0
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Markdown**: React Markdown with GFM
- **Code Highlighting**: React Syntax Highlighter
- **Particles**: tsparticles

### Python Services
- **RAG/Chroma**:
  - ChromaDB
  - LangChain & LangChain Community
  - Google Generative AI
  - Sentence Transformers
  - FastAPI & Uvicorn
  - PyTorch
  - Transformers & Accelerate

- **Notion MCP**:
  - FastMCP
  - httpx
  - python-dotenv

- **Document Parser**:
  - Flask
  - python-docx
  - python-pptx
  - WeasyPrint (HTML to PDF)

## 📦 Project Structure

```
Final_project/
├── backend/                 # Go backend API
│   ├── controllers/         # API controllers
│   ├── models/              # Database models
│   ├── routes/              # Route definitions
│   ├── services/            # Business logic
│   ├── middleware/          # Middleware (CORS, auth)
│   ├── database/            # Database connection
│   ├── utils/               # Utility functions
│   ├── media/               # Media file storage
│   ├── main.go              # Application entry point
│   ├── go.mod               # Go dependencies
│   ├── Dockerfile           # Docker configuration
│   └── compose.yaml         # Docker Compose configuration
│
├── frontend/                # Next.js frontend
│   ├── src/
│   │   ├── app/             # Next.js app router
│   │   ├── components/      # React components
│   │   │   ├── auth/        # Authentication components
│   │   │   ├── chat/        # Chat interface
│   │   │   ├── rag/         # RAG assistant
│   │   │   ├── media/       # Media gallery
│   │   │   └── ui/          # Reusable UI components
│   │   └── lib/             # Utilities and API client
│   ├── public/              # Static assets
│   ├── package.json         # Node dependencies
│   ├── Dockerfile           # Docker configuration
│   └── compose.yaml         # Docker Compose configuration
│
├── chroma/                  # RAG/Chroma services
│   ├── .venv/               # Python virtual environment
│   ├── RAG/                 # RAG implementations
│   │   ├── cpu_rag/         # CPU-accelerated RAG
│   │   └── gpu_rag/         # GPU-accelerated RAG
│   ├── grag/                # Graph RAG implementations
│   ├── game/                # Game-related RAG
│   ├── main.py              # Chroma service entry point
│   └── requirements.txt     # Python dependencies
│
├── doc_parser/              # Document conversion services
│   ├── docx-converter/      # DOCX conversion service
│   ├── html-pdf-convertor/  # HTML to PDF service
│   ├── pptx-converter/      # PPTX conversion service
│   ├── README.md            # API documentation
│   └── api.md               # API endpoint details
│
├── notion_mcp/              # Notion MCP server
│   ├── server.py            # MCP server implementation
│   ├── config.yaml          # MCP configuration
│   ├── mcp_config.json      # MCP client config
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Notion API credentials
│
├── .gitignore               # Git ignore rules
└── README.md                # This file
```

## 🚀 Getting Started

### Prerequisites

- **Docker** & **Docker Compose** (for containerized deployment)
- **Go** 1.24+ (for local backend development)
- **Node.js** 18+ (for local frontend development)
- **Python** 3.10+ (for Python services)
- **MySQL** 8.0+ (for database)

### Environment Variables

Create `.env` files in each service directory:

**Backend (backend/.env)**:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
JWT_SECRET=your_jwt_secret_key
PORT=1234
MEDIA_DIR=./media
```

**Frontend (frontend/.env)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:1234
```

**Notion MCP (notion_mcp/.env)**:
```env
NOTION_TOKEN=your_notion_integration_token
NOTION_BASE_URL=https://api.notion.com
NOTION_VERSION=2022-06-28
MCP_PORT=8001
```

### Running with Docker (Recommended)

#### Backend Only
```bash
cd backend
docker compose up --build
```
The backend will be available at `http://localhost:1234`

#### Frontend Only
```bash
cd frontend
docker compose up --build
```
The frontend will be available at `http://localhost:3000`

#### Full Stack
Run each service in separate terminals:
```bash
# Terminal 1 - Backend
cd backend
docker compose up --build

# Terminal 2 - Frontend
cd frontend
docker compose up --build
```

### Running Locally (Development)

#### Backend
```bash
cd backend
go mod download
go run main.go
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Chroma/RAG Services
```bash
cd chroma
python -m venv .venv

# Windows PowerShell
.\\.venv\\Scripts\\Activate.ps1

# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
python main.py
```

#### Notion MCP Server
```bash
cd notion_mcp
python -m venv .venv

# Windows PowerShell
.\\.venv\\Scripts\\Activate.ps1

# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
python server.py
```

#### Document Parser Services
Each converter service has its own setup:
```bash
cd doc_parser/docx-converter
python -m venv venv
# Activate venv and install requirements
pip install -r requirements.txt
python app.py
```

## 🔌 API Documentation

### Backend API Endpoints

The backend provides RESTful APIs for:
- **Authentication**: `/api/auth/*` - Login, signup, token refresh
- **Users**: `/api/users/*` - User management
- **Chat**: `/api/chat/*` - Chat operations
- **RAG**: `/api/rag/*` - Document upload, querying, collections
- **Media**: `/api/media/*` - Media generation and management
- **Files**: Static file serving at `/media/*`

### Document Parser API

See [doc_parser/README.md](doc_parser/README.md) for detailed API documentation:
- **HTML to PDF**: `POST /api/convert-pdf`
- **DOCX Conversion**: `POST /api/convert-docx`
- **PPTX Conversion**: `POST /api/convert-pptx`

### Notion MCP

The Notion MCP server provides tools for:
- User management
- Page and database operations
- Block content manipulation
- Search and query
- Comments

See [notion_mcp/server.py](notion_mcp/server.py) for available tools.

## 🗄️ Database Setup

### MySQL Setup

1. Create a MySQL database:
```sql
CREATE DATABASE final_project CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. The backend will auto-migrate tables on startup using GORM AutoMigrate.

### ChromaDB Setup

ChromaDB data is stored locally in the `chroma/` directory. The vector database is automatically initialized on first run.

## 🧪 Testing

### Backend Testing
```bash
cd backend
go test ./...
```

### Frontend Testing
```bash
cd frontend
npm test
```

## 📦 Building for Production

### Backend
```bash
cd backend
go build -o backend main.go
./backend
```

### Frontend
```bash
cd frontend
npm run build
npm start
```

### Docker Images
```bash
# Build backend image
cd backend
docker build -t backend-api .

# Build frontend image
cd frontend
docker build -t frontend-app .
```

## 🔧 Configuration

### Backend Configuration
- Port: Configurable via `PORT` env var (default: 1234)
- Database: MySQL connection via env vars
- JWT: Secret key via `JWT_SECRET`
- File Upload: 100MB limit configured in main.go

### Frontend Configuration
- API URL: `NEXT_PUBLIC_API_URL` env var
- Theme: Dark mode by default with next-themes
- Styling: Tailwind CSS with custom glassmorphism utilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and conventions
- Add comments for complex logic
- Update documentation for API changes
- Test your changes before submitting
- Ensure all environment variables are documented

## 📝 License

This project is a final year microservices architecture assignment.

## 👥 Authors

- Project Team - Final Year Microservices Project

## 🙏 Acknowledgments

- Fiber Framework - Go web framework
- Next.js Team - React framework
- LangChain - LLM application framework
- ChromaDB - Vector database
- Notion API - Integration platform

## 📞 Support

For issues, questions, or contributions, please open an issue in the repository.
