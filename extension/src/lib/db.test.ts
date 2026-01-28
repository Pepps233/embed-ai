import { describe, it, expect, beforeEach } from 'vitest';
import { EmbedAIDB } from './db';
import { DocumentType, ProcessingStatus, NoteType, CreatedFrom } from '@shared/types';
import type { Document, Highlight, Note } from '@shared/types';

describe('EmbedAIDB', () => {
  let db: EmbedAIDB;

  beforeEach(async () => {
    db = new EmbedAIDB();
    await db.delete();
    await db.open();
  });

  describe('Database initialization', () => {
    it('should create database with correct tables', () => {
      expect(db.documents).toBeDefined();
      expect(db.pageText).toBeDefined();
      expect(db.chunks).toBeDefined();
      expect(db.vectorReferences).toBeDefined();
      expect(db.highlights).toBeDefined();
      expect(db.notes).toBeDefined();
      expect(db.syncState).toBeDefined();
    });

    it('should have correct database name', () => {
      expect(db.name).toBe('EmbedAIDB');
    });
  });

  describe('Document operations', () => {
    it('should add a document', async () => {
      const doc: Document = {
        id: 'doc-1',
        type: DocumentType.WEB_PAGE,
        source: 'https://example.com',
        title: 'Test Document',
        status: ProcessingStatus.READY,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.documents.add(doc);
      const retrieved = await db.documents.get('doc-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('Test Document');
      expect(retrieved?.source).toBe('https://example.com');
    });

    it('should retrieve document by source', async () => {
      const doc: Document = {
        id: 'doc-2',
        type: DocumentType.WEB_PAGE,
        source: 'https://test.com',
        title: 'Test',
        status: ProcessingStatus.READY,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.documents.add(doc);
      const results = await db.documents.where('source').equals('https://test.com').toArray();
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-2');
    });
  });

  describe('Highlight operations', () => {
    it('should add a highlight', async () => {
      const highlight: Highlight = {
        id: 'hl-1',
        document_id: 'doc-1',
        quote_text: 'Highlighted text',
        anchor: {
          start_offset: 0,
          end_offset: 16,
          start_context: '',
          end_context: ''
        },
        color: '#FFEB3B',
        created_at: new Date().toISOString(),
      };

      await db.highlights.add(highlight);
      const retrieved = await db.highlights.get('hl-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.quote_text).toBe('Highlighted text');
      expect(retrieved?.color).toBe('#FFEB3B');
    });

    it('should retrieve highlights by document_id', async () => {
      const highlights: Highlight[] = [
        {
          id: 'hl-1',
          document_id: 'doc-1',
          quote_text: 'First highlight',
          anchor: {
            start_offset: 0,
            end_offset: 15,
            start_context: '',
            end_context: ''
          },
          color: '#FFEB3B',
          created_at: new Date().toISOString(),
        },
        {
          id: 'hl-2',
          document_id: 'doc-1',
          quote_text: 'Second highlight',
          anchor: {
            start_offset: 20,
            end_offset: 36,
            start_context: '',
            end_context: ''
          },
          color: '#4CAF50',
          created_at: new Date().toISOString(),
        },
      ];

      await db.highlights.bulkAdd(highlights);
      const results = await db.highlights.where('document_id').equals('doc-1').toArray();
      
      expect(results).toHaveLength(2);
    });
  });

  describe('Note operations', () => {
    it('should add a note', async () => {
      const note: Note = {
        id: 'note-1',
        document_id: 'doc-1',
        highlight_id: 'hl-1',
        content: 'This is a test note',
        metadata: {
          tags: [],
          type: NoteType.INSIGHT,
          created_from: CreatedFrom.MANUAL
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.notes.add(note);
      const retrieved = await db.notes.get('note-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('This is a test note');
    });

    it('should retrieve notes by highlight_id', async () => {
      const note: Note = {
        id: 'note-1',
        document_id: 'doc-1',
        highlight_id: 'hl-1',
        content: 'Test note',
        metadata: {
          tags: [],
          type: NoteType.INSIGHT,
          created_from: CreatedFrom.MANUAL
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.notes.add(note);
      const results = await db.notes.where('highlight_id').equals('hl-1').toArray();
      
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Test note');
    });
  });

  describe('Sync state operations', () => {
    it('should track dirty entities', async () => {
      const syncState = {
        id: 'sync-1',
        entity_type: 'highlight' as const,
        entity_id: 'hl-1',
        is_dirty: true,
      };

      await db.syncState.add(syncState);
      const dirty = await db.syncState.where('is_dirty').equals(1).toArray();
      
      expect(dirty).toHaveLength(1);
      expect(dirty[0].entity_id).toBe('hl-1');
    });
  });
});
