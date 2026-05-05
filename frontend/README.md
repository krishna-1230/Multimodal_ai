# AI Chat Platform Frontend

A premium, dark-themed frontend for the unified AI chat platform with glassmorphism effects and modern animations.

## Features

### 🎨 **Premium Design**
- Dark theme with electric blue accents
- Glassmorphism effects throughout the UI
- Smooth animations and transitions
- Particle background effects
- Responsive design for all devices

### 💬 **Chat Interface**
- Real-time chat with AI models
- Conversation history with sidebar
- Markdown support with syntax highlighting
- Message copying and timestamps
- Typing indicators and loading states

### 📚 **RAG Assistant**
- Document upload and collection management
- RAG-powered chat with your documents
- Multiple file format support (PDF, Word, text, etc.)
- Collection browsing and search
- Document-based Q&A with context

### 🎥 **Media Gallery**
- Browse all generated content (images, videos, audio)
- Grid and list view modes
- Filter by type and search functionality
- Media viewer with download options
- AI content generation panel

### 🔐 **Authentication**
- Secure login and signup
- JWT token management
- User profile and settings
- Session persistence

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS with custom glassmorphism utilities
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Theme**: Next Themes for dark mode
- **Code Highlighting**: React Syntax Highlighter
- **Markdown**: React Markdown with GitHub Flavored Markdown

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:1234
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Project Structure

```
frontend/
├── src/
│   ├── app/                 # Next.js app router
│   │   ├── globals.css      # Global styles and utilities
│   │   ├── layout.js        # Root layout with providers
│   │   └── page.js          # Home page component
│   ├── components/
│   │   ├── auth/            # Authentication components
│   │   ├── chat/            # Chat interface components
│   │   ├── rag/             # RAG assistant components
│   │   ├── media/           # Media gallery components
│   │   ├── layout/          # Layout components (navbar, sidebar)
│   │   └── ui/              # Reusable UI components
│   └── lib/
│       ├── api.js           # API client and utilities
│       └── auth-context.js  # Authentication context
├── public/                  # Static assets
├── tailwind.config.js       # Tailwind configuration
└── package.json
```

## Key Components

### Authentication
- `LoginPage`: Beautiful login/signup form with glassmorphism
- `AuthProvider`: Context provider for authentication state

### Chat Interface
- `ChatInterface`: Main chat component with message history
- `MessageBubble`: Individual message component with markdown support
- `ChatInput`: Advanced input with voice recording and file upload

### RAG Assistant
- `RagInterface`: Document-based chat interface
- `DocumentUpload`: Drag-and-drop file upload with progress
- `CollectionSelector`: Collection management and selection

### Media Gallery
- `MediaGallery`: Grid/list view of generated content
- `MediaViewer`: Full-screen media viewer with details
- `GenerationPanel`: AI content generation interface

### Layout
- `Navbar`: Top navigation with user menu and view switcher
- `Sidebar`: Conversation history with search and grouping
- `Dashboard`: Main application layout

## Styling System

### Glassmorphism Classes
- `.glass`: Basic glassmorphism effect
- `.glass-strong`: Enhanced glassmorphism with more opacity
- `.glass-subtle`: Subtle glassmorphism for backgrounds

### Animations
- `.animate-float`: Floating animation for elements
- `.animate-fadeIn`: Fade in animation for new content
- `.glow-blue`: Electric blue glow effect

### Color Scheme
- Primary: Electric blue tones (#3b82f6, #1d4ed8)
- Secondary: Purple/pink gradients for accents
- Background: Dark gradients with blue undertones

## API Integration

The frontend integrates with the Go backend through a comprehensive API client:

- **Authentication**: Login, signup, user profile
- **Chat**: Message sending, conversation management
- **RAG**: Document upload, querying, collection management
- **Media**: Content generation, gallery browsing
- **Integrations**: SDXL, Flux, music generation, video generation

## Performance Features

- Lazy loading for media content
- Optimized images and assets
- Efficient state management
- Minimal bundle size with tree shaking
- Fast navigation with Next.js App Router

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is part of a final year microservices architecture project.