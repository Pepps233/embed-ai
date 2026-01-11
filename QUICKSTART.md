# Quick Start Guide

## What You Have Now

A complete project foundation for your Hybrid Local-Cloud Knowledge Companion with:

### ✅ Browser Extension (Manifest V3)
- React + TypeScript + Vite
- IndexedDB (Dexie) for local storage
- Content scripts for page interaction
- Side panel UI with tabs (Highlights, Notes, Q&A)
- Popup interface
- PDF.js ready for PDF support

### ✅ FastAPI Backend
- Structured API with versioning
- Stub endpoints for embeddings, documents, and queries
- Service layer architecture (embeddings, vector store, PDF processor, LLM)
- Pydantic schemas for type safety
- Environment configuration

### ✅ Shared Data Models
- TypeScript interfaces in `shared/types/`
- Python Pydantic models in `backend/app/models/schemas.py`
- Consistent data structures across stack

### ✅ Documentation
- Architecture Decision Records (ADRs)
- Setup instructions
- Component READMEs

## Next Steps

### 1. Install Backend Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Note**: Some ML packages (torch, transformers) are large. Consider installing only what you need initially.

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
```

You'll need:
- Supabase account (free tier available)
- Pinecone account (free tier available)

### 3. Test the Extension

```bash
cd extension
npm run dev
```

Then load in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/dist`

### 4. Test the Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` for API documentation.

## Implementation Roadmap

Follow the phased approach from your white paper:

### Phase 1: Local Reading & Storage (Start Here)
- [ ] Implement IndexedDB CRUD operations
- [ ] DOM text extraction
- [ ] Highlight creation with Range API
- [ ] Notes system

### Phase 2: Short PDF Support
- [ ] PDF.js integration
- [ ] Client-side text extraction
- [ ] Chunking pipeline

### Phase 3: Backend Core
- [ ] Supabase Auth integration
- [ ] File upload endpoints
- [ ] JWT verification

### Phase 4: Embeddings & Vector Search
- [ ] BGE/Instructor model integration
- [ ] Pinecone setup
- [ ] Embedding generation endpoint

### Phase 5: Question Answering
- [ ] Retrieval pipeline
- [ ] Llama 3 integration
- [ ] Citation formatting

### Phase 6: Large PDF Escalation
- [ ] Backend PDF parsing
- [ ] Threshold detection
- [ ] Unified query path

### Phase 7: Sync & Multi-Device
- [ ] Cloud sync logic
- [ ] Conflict resolution
- [ ] Offline reconciliation

### Phase 8: Hardening
- [ ] Security audit
- [ ] Rate limiting
- [ ] Permission tightening

## Project Structure

```
embed-ai/
├── extension/              # Browser extension
│   ├── src/
│   │   ├── background/    # Service worker
│   │   ├── content/       # Content scripts
│   │   ├── popup/         # Extension popup
│   │   ├── sidepanel/     # Side panel UI
│   │   ├── lib/           # Utilities (DB, helpers)
│   │   └── styles/        # Global styles
│   ├── public/            # Static assets
│   └── package.json
│
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── api/          # API routes
│   │   ├── core/         # Config
│   │   ├── models/       # Schemas
│   │   └── services/     # Business logic
│   └── requirements.txt
│
├── shared/               # Shared types
│   └── types/
│       └── index.ts
│
└── docs/                 # Documentation
    ├── ADR-001-core-invariants.md
    └── ADR-002-data-models.md
```

## Key Files to Know

### Extension
- `extension/src/manifest.json` - Extension configuration
- `extension/src/lib/db.ts` - IndexedDB schema
- `extension/src/sidepanel/App.tsx` - Main UI

### Backend
- `backend/app/main.py` - FastAPI app entry
- `backend/app/core/config.py` - Settings
- `backend/app/models/schemas.py` - Data models

### Shared
- `shared/types/index.ts` - TypeScript types

## Tips

1. **Start Small**: Implement Phase 1 features first before adding AI/ML
2. **Test Locally**: Use the extension on simple web pages initially
3. **Incremental**: Add one feature at a time, test thoroughly
4. **Icons**: Replace placeholder icons in `extension/public/icons/`
5. **Dependencies**: Backend ML packages are large - install as needed

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Dexie.js Docs](https://dexie.org/)
- [PDF.js Docs](https://mozilla.github.io/pdf.js/)
- [Pinecone Docs](https://docs.pinecone.io/)
- [Supabase Docs](https://supabase.com/docs)

## Getting Help

Check these files for detailed information:
- `SETUP.md` - Complete setup instructions
- `README.md` - Project overview
- `docs/ADR-*.md` - Architecture decisions
- Component READMEs in `extension/` and `backend/`
