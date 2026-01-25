/**
 * Notes Manager
 * Phase 1.5 - Local notes system with metadata support
 */

import { noteHelpers, highlightHelpers, documentHelpers } from '../lib/db-helpers';
import type { Note, NoteMetadata, NoteType, CreatedFrom } from '@shared/types';

export interface CreateNoteOptions {
  documentId: string;
  highlightId?: string;
  content: string;
  tags?: string[];
  type?: NoteType;
  createdFrom?: CreatedFrom;
}

/**
 * Create a new note
 */
export async function createNote(options: CreateNoteOptions): Promise<string> {
  const {
    documentId,
    highlightId,
    content,
    tags = [],
    type = 'summary' as NoteType,
    createdFrom = 'manual' as CreatedFrom,
  } = options;

  const metadata: NoteMetadata = {
    tags,
    type,
    created_from: createdFrom,
  };

  const noteId = await noteHelpers.create({
    document_id: documentId,
    highlight_id: highlightId,
    content,
    metadata,
  });

  return noteId;
}

/**
 * Update note content
 */
export async function updateNoteContent(noteId: string, content: string): Promise<void> {
  await noteHelpers.update(noteId, { content });
}

/**
 * Update note metadata
 */
export async function updateNoteMetadata(
  noteId: string,
  metadata: Partial<NoteMetadata>
): Promise<void> {
  const note = await noteHelpers.get(noteId);
  if (!note) throw new Error('Note not found');

  const updatedMetadata: NoteMetadata = {
    ...note.metadata,
    ...metadata,
  };

  await noteHelpers.update(noteId, { metadata: updatedMetadata });
}

/**
 * Add tags to note
 */
export async function addNoteTags(noteId: string, tags: string[]): Promise<void> {
  const note = await noteHelpers.get(noteId);
  if (!note) throw new Error('Note not found');

  const existingTags = note.metadata.tags || [];
  const newTags = [...new Set([...existingTags, ...tags])];

  await updateNoteMetadata(noteId, { tags: newTags });
}

/**
 * Remove tags from note
 */
export async function removeNoteTags(noteId: string, tags: string[]): Promise<void> {
  const note = await noteHelpers.get(noteId);
  if (!note) throw new Error('Note not found');

  const existingTags = note.metadata.tags || [];
  const newTags = existingTags.filter((tag) => !tags.includes(tag));

  await updateNoteMetadata(noteId, { tags: newTags });
}

/**
 * Get note with related data
 */
export interface NoteWithContext {
  note: Note;
  highlight?: {
    id: string;
    quote_text: string;
    color?: string;
  };
  document: {
    id: string;
    title?: string;
    source: string;
  };
}

export async function getNoteWithContext(noteId: string): Promise<NoteWithContext | null> {
  const note = await noteHelpers.get(noteId);
  if (!note) return null;

  const document = await documentHelpers.get(note.document_id);
  if (!document) return null;

  let highlight;
  if (note.highlight_id) {
    const h = await highlightHelpers.get(note.highlight_id);
    if (h) {
      highlight = {
        id: h.id,
        quote_text: h.quote_text,
        color: h.color,
      };
    }
  }

  return {
    note,
    highlight,
    document: {
      id: document.id,
      title: document.title,
      source: document.source,
    },
  };
}

/**
 * Get all notes for a document with context
 */
export async function getDocumentNotesWithContext(
  documentId: string
): Promise<NoteWithContext[]> {
  const notes = await noteHelpers.getNotesByDocument(documentId);
  const document = await documentHelpers.get(documentId);
  
  if (!document) return [];

  const notesWithContext: NoteWithContext[] = [];

  for (const note of notes) {
    let highlight;
    if (note.highlight_id) {
      const h = await highlightHelpers.get(note.highlight_id);
      if (h) {
        highlight = {
          id: h.id,
          quote_text: h.quote_text,
          color: h.color,
        };
      }
    }

    notesWithContext.push({
      note,
      highlight,
      document: {
        id: document.id,
        title: document.title,
        source: document.source,
      },
    });
  }

  return notesWithContext;
}

/**
 * Delete note
 */
export async function deleteNote(noteId: string): Promise<void> {
  await noteHelpers.delete(noteId);
}

/**
 * Search notes by content or tags
 */
export async function searchNotes(query: string): Promise<Note[]> {
  const allNotes = await noteHelpers.getAll();
  const lowerQuery = query.toLowerCase();

  return allNotes.filter((note) => {
    const contentMatch = note.content.toLowerCase().includes(lowerQuery);
    const tagMatch = note.metadata.tags.some((tag) =>
      tag.toLowerCase().includes(lowerQuery)
    );
    return contentMatch || tagMatch;
  });
}

/**
 * Get notes by type
 */
export async function getNotesByType(type: NoteType): Promise<Note[]> {
  const allNotes = await noteHelpers.getAll();
  return allNotes.filter((note) => note.metadata.type === type);
}

/**
 * Get notes by tag
 */
export async function getNotesByTag(tag: string): Promise<Note[]> {
  const allNotes = await noteHelpers.getAll();
  return allNotes.filter((note) => note.metadata.tags.includes(tag));
}

/**
 * Get all unique tags across all notes
 */
export async function getAllTags(): Promise<string[]> {
  const allNotes = await noteHelpers.getAll();
  const tags = new Set<string>();

  allNotes.forEach((note) => {
    note.metadata.tags.forEach((tag) => tags.add(tag));
  });

  return Array.from(tags).sort();
}
