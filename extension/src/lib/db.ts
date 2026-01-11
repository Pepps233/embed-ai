import Dexie, { Table } from 'dexie';
import type { Document, Highlight, Note, TextChunk, VectorReference } from '@shared/types';

export class KnowledgeCompanionDB extends Dexie {
  documents!: Table<Document, string>;
  highlights!: Table<Highlight, string>;
  notes!: Table<Note, string>;
  chunks!: Table<TextChunk, string>;
  vectorReferences!: Table<VectorReference, string>;

  constructor() {
    super('KnowledgeCompanionDB');
    
    this.version(1).stores({
      documents: 'id, type, source, status, created_at',
      highlights: 'id, document_id, created_at',
      notes: 'id, document_id, highlight_id, created_at, updated_at',
      chunks: 'id, document_id, page_number, vector_id',
      vectorReferences: 'chunk_id, vector_id, embedding_status'
    });
  }
}

export const db = new KnowledgeCompanionDB();
