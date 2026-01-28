# Embed AI Browser Tool

A browser-based knowledge companion for reading, annotation, and question answering with hybrid local-cloud architecture.

## Project Structure

```
embed-ai/
├── extension/          # Browser extension (Manifest V3 + Vite)
├── backend/           # FastAPI backend service
├── shared/            # Shared schemas and types
└── docs/              # Architecture Decision Records
```

### Frontend
- **Framework**: Vite + TypeScript
- **Storage**: IndexedDB (via Dexie.js)
- **PDF**: PDF.js
- **UI**: React + TailwindCSS

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Vector DB**: Pinecone
- **Embeddings**: BGE / Instructor
- **LLM**: Llama 3
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth

### Extension Development
```bash
cd extension
npm install
npm run dev
```

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Keyboard Shortcuts
Highlight Creation:
- `Ctrl + Shift + L` (Windows/Linux) or `Cmd + Shift + L` (Mac)
Side Panel:
- `Ctrl + Shift + K` (Windows/Linux) or `Cmd + Shift + K` (Mac)