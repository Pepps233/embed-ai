import { useState, useEffect } from 'react';
import { MessageSquare, Highlighter, StickyNote } from 'lucide-react';
import { ChatTab } from './components/ChatTab';
import { HighlightsTab } from './components/HighlightsTab';
import { NotesTab } from './components/NotesTab';

type Tab = 'chat' | 'highlights' | 'notes';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);

  // Get current document ID from content script or PDF viewer
  useEffect(() => {
    /**
     * Fetch document ID from the active tab.
     * For web pages: sends message to content script
     * For PDF viewer: gets from chrome.storage.session
     */
    const fetchDocumentId = async () => {
      // First check chrome.storage.session for PDF viewer document ID
      try {
        const result = await chrome.storage.session.get('currentPdfDocumentId');
        if (result.currentPdfDocumentId) {
          setCurrentDocumentId(result.currentPdfDocumentId as string);
          return;
        }
      } catch {
        // Session storage not available, continue
      }

      // Fall back to content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          // Check if this is our PDF viewer page
          const url = tabs[0].url || '';
          if (url.includes('pdf-viewer/index.html')) {
            // For PDF viewer, document ID will come via message
            return;
          }

          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: 'GET_DOCUMENT_ID' },
            (response) => {
              if (chrome.runtime.lastError) {
                // Content script not available (e.g., extension pages)
                return;
              }
              if (response?.documentId) {
                setCurrentDocumentId(response.documentId);
              }
            }
          );
        }
      });
    };

    fetchDocumentId();

    // Listen for storage changes (PDF viewer updates)
    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.currentPdfDocumentId?.newValue) {
        setCurrentDocumentId(changes.currentPdfDocumentId.newValue as string);
      }
    };
    chrome.storage.session.onChanged.addListener(storageListener);

    const messageListener = (message: any) => {
      if (message.type === 'HIGHLIGHT_CREATED') {
        if (message.documentId) {
          setCurrentDocumentId(message.documentId);
        } else {
          fetchDocumentId();
        }
        setActiveTab('highlights');
      } else if (message.type === 'HIGHLIGHT_CLICKED') {
        setActiveTab('highlights');
      } else if (message.type === 'NOTE_CREATED') {
        if (message.documentId) {
          setCurrentDocumentId(message.documentId);
        } else {
          fetchDocumentId();
        }
        setActiveTab('notes');
      } else if (message.type === 'PDF_DOCUMENT_LOADED') {
        // PDF viewer loaded a document
        if (message.documentId) {
          setCurrentDocumentId(message.documentId);
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.session.onChanged.removeListener(storageListener);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-4 py-3 bg-white">
        <h1 className="text-base font-semibold text-gray-900">Embed AI</h1>
      </header>

      {/* Tabs */}
      <nav className="border-b border-gray-200 flex bg-white">
        <button
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            activeTab === 'chat'
              ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
        </button>
        <button
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            activeTab === 'highlights'
              ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('highlights')}
        >
          <Highlighter className="w-4 h-4" />
          <span>Highlights</span>
        </button>
        <button
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            activeTab === 'notes'
              ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('notes')}
        >
          <StickyNote className="w-4 h-4" />
          <span>Notes</span>
        </button>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'highlights' && <HighlightsTab currentDocumentId={currentDocumentId} />}
        {activeTab === 'notes' && <NotesTab currentDocumentId={currentDocumentId} />}
      </main>
    </div>
  );
}

export default App;
