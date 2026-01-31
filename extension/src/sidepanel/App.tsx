import { useState, useEffect } from 'react';
import { MessageSquare, Highlighter, StickyNote } from 'lucide-react';
import { ChatTab } from './components/ChatTab';
import { HighlightsTab } from './components/HighlightsTab';
import { NotesTab } from './components/NotesTab';

type Tab = 'chat' | 'highlights' | 'notes';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);

  // Get current document ID from content script
  useEffect(() => {
    /**
     * Chrome.tabs.query: "gets all tabs that have the specified properties, or all tabs
     * if no properties are specified"
     * 
     * Find all tabs that are active in the current window, then call arrow function with the result
     */
    const fetchDocumentId = () => {
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
    };

    fetchDocumentId();

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
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
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
