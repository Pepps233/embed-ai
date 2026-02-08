# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Embed AI is a browser extension for reading, annotation, and question answering with a hybrid local-cloud architecture. The system combines local-first IndexedDB storage with cloud-based vector search (Pinecone) and LLM capabilities (Llama 3).

## Development Commands

### Extension (Browser)

```bash
cd extension

# Development
npm install                # Install dependencies
npm run dev               # Development mode with hot reload
npm run build             # Production build
npm run type-check        # TypeScript type checking

# Testing
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:ui           # UI mode
```

To load the extension in Chrome after building:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/dist` directory

### Backend (Python)

```bash
cd backend

# Setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt

# Running
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Testing
pytest                           # Run all tests
pytest backend_tests/unit/       # Unit tests only
pytest backend_tests/integration/ # Integration tests only
pytest --cov=app                 # With coverage
pytest -m unit                   # Tests marked as unit
pytest -m integration            # Tests marked as integration

# Linting & Type Checking
ruff check .                     # Lint with Ruff
ruff format .                    # Format code
mypy app/                        # Type checking
```

API documentation available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Architecture

### Three-Tier Storage Model

1. **IndexedDB (Client)**: Local-first storage via Dexie.js
   - Immediate reads/writes for UX
   - Offline-first capability
   - Tables: documents, pageText, chunks, vectorReferences, highlights, notes, syncState
   - Database class: `extension/src/lib/db.ts` (EmbedAIDB)

2. **Supabase (Cloud)**: Multi-device sync and authentication
   - Postgres with Row Level Security (RLS)
   - Storage for PDFs
   - JWT-based auth
   - Syncs with IndexedDB via background workers

3. **Pinecone (Vector Store)**: Semantic search (backend-only)
   - BGE-small-en-v1.5 embeddings (384 dimensions)
   - Always filtered by user_id
   - Treated as cache, not source of truth

### Key Data Flow

```
User Action → IndexedDB (instant) → Mark dirty → Background sync → Supabase
Client → Backend API → Embed text → Pinecone upsert
Client → Backend API → Embed query → Pinecone search (filtered by user_id)
```

### PDF Processing Strategy

- **Small PDFs** (< 50 pages or 10MB): Client-side extraction with PDF.js, backend embedding
- **Large PDFs** (> threshold): Backend ingestion with PyMuPDF/pdfplumber

## Code Organization

### Extension Structure

```
extension/src/
├── background/          # Service worker (Manifest V3)
├── content/             # Content scripts injected into web pages
├── sidepanel/          # React-based side panel UI
├── popup/              # Extension popup UI
├── lib/                # Core libraries
│   ├── db.ts           # Dexie IndexedDB schema
│   ├── db-helpers.ts   # Database utilities
│   └── utils.ts        # Shared utilities
├── services/           # API clients and service layers
├── styles/             # Global styles (Tailwind)
└── manifest.json       # Chrome extension manifest
```

### Backend Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── api/v1/              # API routes
│   │   ├── router.py        # Main router
│   │   └── endpoints/       # Endpoint modules
│   ├── core/                # Configuration and settings
│   ├── models/              # Pydantic models
│   └── services/            # Business logic
│       ├── embeddings.py    # Embedding generation (BGE)
│       ├── llm.py           # LLM integration (Llama 3)
│       ├── pdf_processor.py # PDF text extraction
│       └── vector_store.py  # Pinecone operations
├── backend_tests/
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
├── pyproject.toml          # Ruff and mypy config
└── pytest.ini              # Pytest configuration
```

### Shared Types

The `shared/types/index.ts` file contains TypeScript interfaces shared between extension and backend:
- Document, Highlight, Note, TextChunk, VectorReference
- Request/Response types for API communication
- Enums for DocumentType, ProcessingStatus, NoteType, CreatedFrom

## Important Patterns

### IndexedDB Version Management

When modifying the database schema in `extension/src/lib/db.ts`:
```typescript
this.version(3).stores({
  // Updated schema
}).upgrade(tx => {
  // Migration logic
});
```
Always increment the version number and provide upgrade logic if needed.

### Sync State Tracking

All entities that sync to Supabase must have corresponding entries in the `syncState` table:
- `is_dirty: true` marks entities needing sync
- Background workers push dirty entities to cloud
- Last-write-wins conflict resolution (initially)

### Path Aliases

Both extension and backend use path aliases:
- Extension: `@/` → `extension/src/`, `@shared/` → `shared/`
- Configured in `vite.config.ts`

## Configuration Files

### Extension
- `extension/tsconfig.json` - TypeScript configuration
- `extension/vite.config.ts` - Vite build configuration (React plugin, web extension plugin)
- `extension/src/manifest.json` - Chrome extension manifest (V3)

### Backend
- `backend/.env` - Environment variables (not in repo, see `.env.example`)
- `backend/pyproject.toml` - Ruff linting and mypy type checking config
- `backend/pytest.ini` - Test configuration with markers (unit, integration, slow)
- `backend/requirements.txt` - Production dependencies
- `backend/requirements-dev.txt` - Development dependencies (includes testing tools)

## Testing Guidelines

### Extension Tests
- Framework: Vitest + Testing Library + happy-dom
- Mock IndexedDB with fake-indexeddb
- Location: `extension/src/tests/`

### Backend Tests
- Framework: pytest with pytest-asyncio
- Use markers: `@pytest.mark.unit`, `@pytest.mark.integration`
- Integration tests may require external services (Supabase, Pinecone)
- Location: `backend/backend_tests/`

## CI/CD

GitHub Actions workflows run on relevant path changes:
- `.github/workflows/extension-ci.yml` - Extension type checking, testing, building
- `.github/workflows/backend-ci.yml` - Backend linting, type checking, tests with coverage

See `CICD_SETUP.md` for detailed CI/CD configuration.

## Core Architectural Decisions

See Architecture Decision Records in `docs/`:
- `ADR-001-core-invariants.md` - Storage architecture, PDF handling, data flow
- `ADR-002-data-models.md` - Data model decisions
- `DATABASE_ARCHITECTURE.md` - Complete three-tier storage documentation

### Key Invariants
- **Local-first is mandatory**: Always write to IndexedDB first
- **Backend for embeddings only**: Client never handles vector operations
- **Privacy-conscious**: Local storage, explicit cloud sync
- **User isolation**: All Pinecone queries filtered by user_id, Supabase RLS enforced
