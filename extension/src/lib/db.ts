import Dexie, { Table } from 'dexie';
import type { Document, Highlight, Note, TextChunk, VectorReference } from '@shared/types';

// Raw extracted text from documents
export interface PageText {
  id: string;
  document_id: string;
  page_number: number;
  text: string;
  char_start: number;
  char_end: number;
  extracted_at: string;
}

// Sync state tracking
export interface SyncState {
  entity_type: 'document' | 'highlight' | 'note';
  entity_id: string;
  is_dirty: boolean;
  last_synced_at?: string;
  sync_error?: string;
}

export class KnowledgeCompanionDB extends Dexie {
  // Local database contract

  /**
   * Table<RowType, PrimaryKeyType> -> represents one IndexedDB object store
   * 
   * Exposes .get(id), .add(row), .put(id), .where('...').equals(...).toArray(), etc.
   * Eg: db.notes.get(string pkey)
   * 
   * Eg: Table<Note, string> -> "this table stores rows shaped like Note, and the primary key is
   * a string"
   */
  
  documents!: Table<Document, string>;
  pageText!: Table<PageText, string>;
  chunks!: Table<TextChunk, string>;
  vectorReferences!: Table<VectorReference, string>;
  highlights!: Table<Highlight, string>;
  notes!: Table<Note, string>;
  syncState!: Table<SyncState, string>;

  constructor() {
    super('KnowledgeCompanionDB');
    
    /**
     * runtime IndexedDB table creation
     * 
     * at runtime, notes: '...' attaches a table instance to KnowledgeCompanionDB class at
     * this.notes, which is at notes!: Table<...>
     */
    this.version(1).stores({
      /**
       * Local document metadata
       * Indexed by page and document -> enables lazy loading & page-by-page processing
       */
      documents: 'id, type, source, status, created_at',
      
      // Page text (extracted from PDFs/web pages)
      pageText: 'id, document_id, page_number',
      
      // Text chunks (for embedding)
      chunks: 'id, document_id, page_number, vector_id',
      
      // Vector references (chunk to Pinecone vector mapping)
      vectorReferences: 'chunk_id, vector_id, embedding_status',
      
      // Highlights (range-anchored)
      highlights: 'id, document_id, created_at',
      
      // Notes (attached to highlights or documents)
      notes: 'id, document_id, highlight_id, created_at, updated_at',
      
      // Sync state (sync tracking)
      syncState: '[entity_type+entity_id], entity_id, is_dirty, last_synced_at'
    });
  }
}

export const db = new KnowledgeCompanionDB();