/**
 * Side Panel App
 */

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Highlighter, MessageSquare, Trash2, Tag, Clock } from 'lucide-react';
import { highlightHelpers, noteHelpers } from '../lib/db-helpers';
import { deleteNote } from '../services/notes-manager';
import type { Highlight, Note } from '@shared/types';

type Tab = 'highlights' | 'notes';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('highlights');
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  /**
   * Live queries for real-time updates
   * 
   * useLiveQuery: Creates a react hook that subscribes to a Dexie liveQuery observable
   */
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

  // Get current document ID from content script when the popup is opened by the user (popup mounts)
  useEffect(() => {
    /**
     * Chrome.tabs.query: "gets all tabs that have the specified properties, or all tabs
     * if no properties are specified"
     * 
     * Find all tabs that are active in the current window, then call arrow function with the result
     */
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: 'GET_DOCUMENT_ID' },
          (response) => {
            if (response?.documentId) {
              setCurrentDocumentId(response.documentId);
            }
          }
        );
      }
    });

    // Begin to listen for highlight creation and note creation events
    const messageListener = (message: any) => {
      if (message.type === 'HIGHLIGHT_CREATED') {
        setCurrentDocumentId(message.documentId);
      } else if (message.type === 'HIGHLIGHT_CLICKED') {
        setSelectedHighlightId(message.highlightId);
        setActiveTab('highlights');
      } else if (message.type === 'NOTE_CREATED') {
        setCurrentDocumentId(message.documentId);
        setActiveTab('notes');
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  const handleDeleteHighlight = async (highlightId: string) => {
    // deletes highlight from db
    await highlightHelpers.delete(highlightId);
    
    // Notify content script to remove from DOM
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'REMOVE_HIGHLIGHT',
          highlightId,
        });
      }
    });
  };

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
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-gray-200">
      {/* Header */}
      <header className="bg-[#252526] border-b border-[#3e3e42] px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-gray-300">Embed</h1>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-[#252526] border-b border-[#3e3e42] flex">
        <button
          className={`flex-1 px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium transition ${
            activeTab === 'highlights'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('highlights')}
        >
          <Highlighter className="w-4 h-4" />
          Highlights
        </button>
        <button
          className={`flex-1 px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium transition ${
            activeTab === 'notes'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('notes')}
        >
          <MessageSquare className="w-4 h-4" />
          Notes
        </button>
      </nav>


      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'highlights' && (
          <div className="p-3 space-y-2">
            {!highlights || highlights.length === 0 ? (
              <div className="text-center text-gray-500 mt-12">
                <Highlighter className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-sm">No highlights yet</p>
                <p className="text-xs mt-1 text-gray-600">
                  Select text on the page to create highlights
                </p>
                <p className="text-xs mt-2 text-gray-600">
                  Shortcut: <kbd className="px-1.5 py-0.5 bg-[#3c3c3c] rounded text-xs">⌘⇧L</kbd>
                </p>
              </div>
            ) : (
              highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className={`bg-[#252526] border border-[#3e3e42] rounded-lg p-3 hover:border-[#4e4e4e] transition cursor-pointer ${
                    selectedHighlightId === highlight.id ? 'border-blue-500' : ''
                  }`}
                  onClick={() => setSelectedHighlightId(highlight.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 leading-relaxed">
                        "{highlight.quote_text}"
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(highlight.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteHighlight(highlight.id);
                      }}
                      className="p-1 hover:bg-[#3c3c3c] rounded transition text-gray-500 hover:text-red-400"
                      title="Delete highlight"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {highlight.color && (
                    <div
                      className="w-full h-1 rounded-full mt-2"
                      style={{ backgroundColor: highlight.color }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="p-3 space-y-2">
            {!notes || notes.length === 0 ? (
              <div className="text-center text-gray-500 mt-12">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-sm">No notes yet</p>
                <p className="text-xs mt-1 text-gray-600">
                  Highlight text and click "Create Note" to add notes
                </p>
              </div>
            ) : (
              notes.map((note) => {
                const highlight = highlights?.find(h => h.id === note.highlight_id);
                const highlightText = highlight?.quote_text || '';
                const isExpanded = expandedNotes.has(note.id);
                const shouldTruncate = highlightText.length > 200;
                const displayText = shouldTruncate && !isExpanded 
                  ? highlightText.substring(0, 200) + '...' 
                  : highlightText;
                
                return (
                  <div
                    key={note.id}
                    className="bg-[#252526] border border-[#3e3e42] rounded-lg p-3 hover:border-[#4e4e4e] transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {highlightText && (
                          <div className="mb-2 pb-2 border-b border-[#3e3e42]">
                            <p className="text-xs text-gray-500 mb-1">Highlighted text:</p>
                            <p className="text-sm text-gray-400 leading-relaxed">
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
                                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                              >
                                {isExpanded ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </div>
                        )}
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {note.content}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {formatDate(note.created_at)}
                          </div>
                          {note.metadata.tags.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Tag className="w-3 h-3" />
                              {note.metadata.tags.join(', ')}
                            </div>
                          )}
                        </div>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 hover:bg-[#3c3c3c] rounded transition text-gray-500 hover:text-red-400"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {note.metadata.type && (
                    <div className="mt-2">
                      <span className="inline-block px-2 py-0.5 bg-[#3c3c3c] text-xs rounded text-gray-400">
                        {note.metadata.type}
                      </span>
                    </div>
                  )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
