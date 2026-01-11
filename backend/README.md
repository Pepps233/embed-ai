# Backend

FastAPI backend service

## Features

- **Embedding Generation**: BGE/Instructor models for text embeddings
- **Vector Search**: Pinecone integration for semantic search
- **PDF Processing**: Server-side processing for large PDFs
- **LLM Inference**: Llama 3 for question answering
- **Storage**: Supabase for file storage and metadata
- **Authentication**: Supabase Auth integration

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Embeddings
- `POST /api/v1/embeddings/embed` - Generate embeddings for text chunks

### Documents
- `POST /api/v1/documents/upload` - Upload large PDF for processing
- `GET /api/v1/documents/{document_id}` - Retrieve document metadata

### Query
- `POST /api/v1/query/ask` - Ask questions using semantic search + LLM

## Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run with specific log level
uvicorn app.main:app --reload --log-level debug
```

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Configuration

See `.env.example` for required environment variables.

## Architecture

```
app/
├── api/
│   └── v1/
│       ├── endpoints/      # API route handlers
│       └── router.py       # Route aggregation
├── core/
│   └── config.py          # Settings and configuration
├── models/
│   └── schemas.py         # Pydantic models
├── services/
│   ├── embeddings.py      # Embedding generation
│   ├── vector_store.py    # Pinecone operations
│   ├── pdf_processor.py   # PDF text extraction
│   └── llm.py            # LLM inference
└── main.py               # FastAPI application
```

## Testing

```bash
# Run tests (when implemented)
pytest

# Run with coverage
pytest --cov=app
```
