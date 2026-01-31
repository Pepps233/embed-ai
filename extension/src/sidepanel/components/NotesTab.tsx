import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MessageSquare, Trash2, Clock, Tag } from 'lucide-react';
import { highlightHelpers, noteHelpers } from '../../lib/db-helpers';
import { deleteNote } from '../../services/notes-manager';

interface NotesTabProps {
  currentDocumentId: string | null;
}

export function NotesTab({ currentDocumentId }: NotesTabProps) {
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const highlights = useLiveQuery(
    async () => {
      if (!currentDocumentId) return [];
      return await highlightHelpers.getHighlightsByDocument(currentDocumentId);
    },
    [currentDocumentId]
  );

  const notes = useLiveQuery(
    async () => {
      if (!currentDocumentId) return [];
      return await noteHelpers.getNotesByDocument(currentDocumentId);
    },
    [currentDocumentId]
  );

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote(noteId);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="p-4 space-y-3">
        {!notes || notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-600 font-medium mb-1">No notes yet</p>
            <p className="text-xs text-gray-400">
              Highlight text and create notes to get started
            </p>
          </div>
        ) : (
          notes.map((note) => {
            const highlight = highlights?.find(h => h.id === note.highlight_id);
            const highlightText = highlight?.quote_text || '';
            const isExpanded = expandedNotes.has(note.id);
            const shouldTruncate = highlightText.length > 150;
            const displayText = shouldTruncate && !isExpanded 
              ? highlightText.substring(0, 150) + '...' 
              : highlightText;
            
            return (
              <div
                key={note.id}
                className="group bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {highlightText && (
                      <div className="mb-3 pb-3 border-b border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1.5">Highlighted text</p>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          "{displayText}"
                        </p>
                        {shouldTruncate && (
                          <button
                            onClick={() => {
                              const newExpanded = new Set(expandedNotes);
                              if (isExpanded) {
                                newExpanded.delete(note.id);
                              } else {
                                newExpanded.add(note.id);
                              }
                              setExpandedNotes(newExpanded);
                            }}
                            className="text-xs text-gray-900 hover:text-gray-700 font-medium mt-1.5"
                          >
                            {isExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-3 mt-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDate(note.created_at)}</span>
                      </div>
                      {note.metadata.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Tag className="w-3.5 h-3.5" />
                          <span>{note.metadata.tags.join(', ')}</span>
                        </div>
                      )}
                      {note.metadata.type && (
                        <span className="inline-block px-2 py-0.5 bg-gray-100 text-xs rounded text-gray-600 font-medium">
                          {note.metadata.type}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-100 rounded transition-all text-gray-400 hover:text-red-600"
                    title="Delete note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
