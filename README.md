# Embed AI

A browser-based knowledge companion for reading, annotation, and question answering with hybrid local-cloud architecture.

## Overview

Embed AI is a browser extension that enables users to highlight, annotate, and interact with web content and PDFs. The system uses a hybrid architecture combining local-first storage with cloud-based vector search and LLM capabilities.

## Project Structure

```
embed-ai/
├── extension/          # Browser extension (Manifest V3 + Vite)
├── backend/           # FastAPI backend service
├── shared/            # Shared schemas and types
├── docs/              # Architecture Decision Records
└── .github/           # CI/CD workflows
```

## Technology Stack

### Extension (Frontend)
- **Framework**: Vite + TypeScript
- **Storage**: IndexedDB (via Dexie.js)
- **PDF Processing**: PDF.js
- **UI**: React + TailwindCSS + Lucide Icons
- **Testing**: Vitest + Testing Library + happy-dom

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Vector Database**: Pinecone
- **Embeddings**: BGE / Instructor
- **LLM**: Llama 3
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **Testing**: pytest + pytest-asyncio
- **Linting**: Ruff + mypy

### CI/CD
- **Platform**: GitHub Actions
- **Workflows**: Separate pipelines for extension and backend
- **Coverage**: Codecov integration

## Development Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- Git

### Extension Development

```bash
cd extension
npm install
npm run dev          # Development mode with hot reload
npm run build        # Production build
npm test             # Run tests
npm run type-check   # TypeScript type checking
```

**Loading the extension in Chrome:**
1. Build the extension: `npm run build`
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` directory

### Backend Development

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**API Documentation:**
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Testing

### Extension Tests
```bash
cd extension
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # UI mode
```

### Backend Tests
```bash
cd backend
source venv/bin/activate
pytest                           # Run all tests
pytest backend_tests/unit/       # Unit tests only
pytest --cov=app                 # With coverage
```

## CI/CD

The project uses GitHub Actions for continuous integration and deployment:

- **Extension CI**: Type checking, testing, and building on every PR/push
- **Backend CI**: Linting, type checking, unit tests, and integration tests
- **Path-based triggers**: Workflows only run when relevant code changes

For detailed CI/CD setup instructions, see [CICD_SETUP.md](CICD_SETUP.md).

## Configuration

### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index_name
```

See `backend/.env.example` for all available options.

## Features

- **Text Highlighting**: Select and highlight text on web pages and PDFs
- **Note Taking**: Attach structured notes to highlights with metadata
- **Local-First Storage**: IndexedDB for offline-first data persistence
- **PDF Support**: Read and annotate PDFs directly in the browser
- **Cloud Sync**: Optional synchronization for multi-device access
- **Question Answering**: Semantic search with LLM-powered responses

### Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Create Highlight | `Ctrl + Shift + L` | `Cmd + Shift + L` |
| Open Side Panel | `Ctrl + Shift + K` | `Cmd + Shift + K` |

## Documentation

- [CI/CD Setup Guide](CICD_SETUP.md)
- [Database Architecture](docs/DATABASE_ARCHITECTURE.md)
- [Architecture Decision Records](docs/)

## Contributing

Contributions are welcome. Please ensure:
- All tests pass before submitting PRs
- Code follows existing style conventions
- New features include appropriate tests
- Documentation is updated as needed

## License

TBD