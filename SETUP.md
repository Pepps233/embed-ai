# Setup Instructions

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Git

## Extension Setup

1. Navigate to the extension directory:
```bash
cd extension
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `extension/dist` directory

5. For development with hot reload:
```bash
npm run dev
```

## Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file:
```bash
cp .env.example .env
```

5. Edit `.env` and add your credentials:
   - Supabase URL and keys
   - Pinecone API key and environment
   - Other configuration values

6. Run the development server:
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## Environment Variables

### Required for Backend

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `PINECONE_API_KEY`: Pinecone API key
- `PINECONE_ENVIRONMENT`: Pinecone environment (e.g., us-west1-gcp)
- `PINECONE_INDEX_NAME`: Name of your Pinecone index

### Optional Configuration

- `SHORT_PDF_MAX_PAGES`: Maximum pages for client-side processing (default: 50)
- `SHORT_PDF_MAX_SIZE_MB`: Maximum file size for client-side processing (default: 10)
- `CHUNK_SIZE`: Token count per chunk (default: 400)
- `CHUNK_OVERLAP`: Overlap between chunks (default: 50)

## Creating Placeholder Icons

The extension requires icons in the `extension/public/icons/` directory:

- `icon-16.png` (16x16)
- `icon-48.png` (48x48)
- `icon-128.png` (128x128)

You can create simple placeholder icons or design custom ones.

## Verification

### Extension
1. Open any webpage
2. Click the extension icon
3. You should see the popup with "Open Side Panel" button

### Backend
1. Visit `http://localhost:8000/docs`
2. You should see the FastAPI interactive documentation
3. Try the `/health` endpoint

## Next Steps

After setup, you can begin implementing features according to the implementation plan:

1. **Phase 1**: Local reading & storage (IndexedDB, DOM extraction, highlights)
2. **Phase 2**: Short PDF support (pdf.js, chunking)
3. **Phase 3**: Backend core (auth, storage)
4. **Phase 4**: Embeddings & vector search
5. **Phase 5**: Question answering
6. **Phase 6**: Large PDF escalation
7. **Phase 7**: Sync & multi-device
8. **Phase 8**: Hardening & trust

## Troubleshooting

### Extension not loading
- Ensure you built the extension (`npm run build`)
- Check for errors in `chrome://extensions/`
- Verify manifest.json is valid

### Backend not starting
- Ensure virtual environment is activated
- Check all required environment variables are set
- Verify Python version is 3.11+

### Dependencies failing to install
- Update pip: `pip install --upgrade pip`
- For torch issues, visit pytorch.org for platform-specific instructions
