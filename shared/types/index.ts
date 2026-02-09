export enum DocumentType {
  WEB_PAGE = "web_page",
  PDF = "pdf",
  EPUB = "epub"
}

export enum ProcessingStatus {
  LOCAL = "local",
  UPLOADING = "uploading",
  PROCESSING = "processing",
  READY = "ready",
  FAILED = "failed"
}

export enum NoteType {
  SUMMARY = "summary",
  INSIGHT = "insight",
  TODO = "todo",
  QUESTION = "question"
}

export enum CreatedFrom {
  MANUAL = "manual",
  SELECTION = "selection",
  AI = "ai"
}

export interface Document {
  id: string;
  type: DocumentType;
  source: string;
  title?: string;
  author?: string;
  status: ProcessingStatus;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface HighlightAnchor {
  start_offset: number;
  end_offset: number;
  start_context: string;
  end_context: string;
  // PDF-specific fields
  page_number?: number;
  quote_text?: string;
}

export interface Highlight {
  id: string;
  document_id: string;
  anchor: HighlightAnchor;
  quote_text: string;
  color?: string;
  created_at: string;
}

export interface NoteMetadata {
  tags: string[];
  type: NoteType;
  created_from: CreatedFrom;
  confidence?: number;
}

export interface Note {
  id: string;
  document_id: string;
  highlight_id?: string;
  content: string;
  metadata: NoteMetadata;
  created_at: string;
  updated_at: string;
}

export interface TextChunk {
  id: string;
  document_id: string;
  page_number?: number;
  text: string;
  char_start: number;
  char_end: number;
  token_count: number;
  vector_id?: string;
}

export interface VectorReference {
  chunk_id: string;
  vector_id: string;
  embedding_status: "pending" | "embedded" | "failed";
  embedded_at?: string;
}

export interface ChunkEmbeddingRequest {
  document_id: string;
  chunks: TextChunk[];
}

export interface ChunkEmbeddingResponse {
  chunk_id: string;
  vector_id: string;
  success: boolean;
  error?: string;
}

export interface QueryRequest {
  question: string;
  document_ids?: string[];
  top_k?: number;
}

export interface Citation {
  document_id: string;
  page_number?: number;
  chunk_id: string;
  text: string;
  relevance_score: number;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  processing_time_ms: number;
}
