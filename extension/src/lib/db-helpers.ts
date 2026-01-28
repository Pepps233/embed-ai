/**
 * IndexedDB CRUD Helpers
 * Phase 1.2 - Database operations layer
 */

import { db } from './db';
import type { Document, Highlight, Note } from '@shared/types';
import type { PageText, SyncState } from './db';

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

export const documentHelpers = {
  async create(doc: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const document: Document = {
      ...doc,
      id,
      created_at: now,
      updated_at: now,
    };
    
    await db.documents.add(document);
    await markDirty('document', id);
    return id;
  },

  async get(id: string): Promise<Document | undefined> {
    return db.documents.get(id);
  },

  async getAll(): Promise<Document[]> {
    return db.documents.orderBy('created_at').reverse().toArray();
  },

  async getBySource(source: string): Promise<Document | undefined> {
    return db.documents.where('source').equals(source).first();
  },

  async update(id: string, updates: Partial<Document>): Promise<void> {
    await db.documents.update(id, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
    await markDirty('document', id);
  },

  async delete(id: string): Promise<void> {
    // Delete related data
    await db.pageText.where('document_id').equals(id).delete();
    await db.chunks.where('document_id').equals(id).delete();
    await db.highlights.where('document_id').equals(id).delete();
    await db.notes.where('document_id').equals(id).delete();
    
    // Delete document
    await db.documents.delete(id);
    
    // Clean up sync state
    // await db.syncState.where('entity_id').equals(id).delete();
    await db.syncState.delete(`document_${id}`);
    console.log("DEBUG: Deleted document sync state", `document_${id}`);
  },
};

// ============================================================================
// PAGE TEXT OPERATIONS
// ============================================================================

export const pageTextHelpers = {
  async create(pageText: Omit<PageText, 'id' | 'extracted_at'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const page: PageText = {
      ...pageText,
      id,
      extracted_at: now,
    };
    
    await db.pageText.add(page);
    return id;
  },

  async getByDocument(documentId: string): Promise<PageText[]> {
    return db.pageText
      .where('document_id')
      .equals(documentId)
      .sortBy('page_number');
  },

  async getPage(documentId: string, pageNumber: number): Promise<PageText | undefined> {
    return db.pageText
      .where('[document_id+page_number]')
      .equals([documentId, pageNumber])
      .first();
  },

  async deleteByDocument(documentId: string): Promise<void> {
    await db.pageText.where('document_id').equals(documentId).delete();
  },
};

// ============================================================================
// HIGHLIGHT OPERATIONS
// ============================================================================

export const highlightHelpers = {
  async create(highlight: Omit<Highlight, 'id' | 'created_at'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const newHighlight: Highlight = {
      ...highlight,
      id,
      created_at: now,
    };
    
    await db.highlights.add(newHighlight);
    await markDirty('highlight', id);
    return id;
  },

  async get(id: string): Promise<Highlight | undefined> {
    return db.highlights.get(id);
  },

  async getHighlightsByDocument(documentId: string): Promise<Highlight[]> {
    return db.highlights
      .where('document_id')
      .equals(documentId)
      .sortBy('created_at');
  },

  async getAll(): Promise<Highlight[]> {
    return db.highlights.orderBy('created_at').reverse().toArray();
  },

  async update(id: string, updates: Partial<Highlight>): Promise<void> {
    await db.highlights.update(id, updates);
    await markDirty('highlight', id);
  },

  async delete(id: string): Promise<void> {
    // Delete related notes
    await db.notes.where('highlight_id').equals(id).delete();
    
    // Delete highlight
    await db.highlights.delete(id);
    
    // Clean up sync state
    // await db.syncState.where('entity_id').equals(id).delete();
    await db.syncState.delete(`highlight_${id}`);
    console.log("DEBUG: Deleted highlight sync state", `highlight_${id}`);
  },
};

// ============================================================================
// NOTE OPERATIONS
// ============================================================================

export const noteHelpers = {
  async create(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const newNote: Note = {
      ...note,
      id,
      created_at: now,
      updated_at: now,
    };
    
    await db.notes.add(newNote);
    await markDirty('note', id);
    return id;
  },

  async get(id: string): Promise<Note | undefined> {
    return db.notes.get(id);
  },

  async getNotesByDocument(documentId: string): Promise<Note[]> {
    return db.notes
      .where('document_id')
      .equals(documentId)
      .sortBy('created_at');
  },

  async getByHighlight(highlightId: string): Promise<Note[]> {
    return db.notes
      .where('highlight_id')
      .equals(highlightId)
      .sortBy('created_at');
  },

  async getAll(): Promise<Note[]> {
    return db.notes.orderBy('created_at').reverse().toArray();
  },

  async update(id: string, updates: Partial<Note>): Promise<void> {
    await db.notes.update(id, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
    await markDirty('note', id);
  },

  async delete(id: string): Promise<void> {
    await db.notes.delete(id);
    // await db.syncState.where('entity_id').equals(id).delete();
    
    await db.syncState.delete(`note_${id}`);
    console.log("DEBUG: Deleted note sync state", `note_${id}`);
  },
};

// ============================================================================
// SYNC STATE OPERATIONS
// ============================================================================

async function markDirty(
  entityType: 'document' | 'highlight' | 'note',
  entityId: string
): Promise<void> {
  const key = `${entityType}_${entityId}`;
  
  const existing = await db.syncState
    .where('[entity_type+entity_id]')
    .equals([entityType, entityId])
    .first();
  
  if (existing) {
    await db.syncState.update(existing.id, {
      is_dirty: true,
      sync_error: undefined,
    });
  } else {
    await db.syncState.add({
      id: key,
      entity_type: entityType,
      entity_id: entityId,
      is_dirty: true,
    });
  }
}

export const syncHelpers = {
  async getDirtyItems(): Promise<SyncState[]> {
    return db.syncState.where('is_dirty').equals(1).toArray();
  },

  async markSynced(entityType: 'document' | 'highlight' | 'note', entityId: string): Promise<void> {
    const key = `${entityType}_${entityId}`;
    await db.syncState.update(key, {
      is_dirty: false,
      last_synced_at: new Date().toISOString(),
      sync_error: undefined,
    });
  },

  async markError(
    entityType: 'document' | 'highlight' | 'note',
    entityId: string,
    error: string
  ): Promise<void> {
    const key = `${entityType}_${entityId}`;
    await db.syncState.update(key, {
      sync_error: error,
    });
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const dbUtils = {
  async clearAll(): Promise<void> {
    await db.documents.clear();
    await db.pageText.clear();
    await db.chunks.clear();
    await db.vectorReferences.clear();
    await db.highlights.clear();
    await db.notes.clear();
    await db.syncState.clear();
  },

  async getStats() {
    const [documents, highlights, notes, pageTexts] = await Promise.all([
      db.documents.count(),
      db.highlights.count(),
      db.notes.count(),
      db.pageText.count(),
    ]);

    return {
      documents,
      highlights,
      notes,
      pageTexts,
    };
  },
};
