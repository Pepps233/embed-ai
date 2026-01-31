import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Highlighter, Trash2, Clock } from 'lucide-react';
import { highlightHelpers } from '../../lib/db-helpers';

interface HighlightsTabProps {
  currentDocumentId: string | null;
}

export function HighlightsTab({ currentDocumentId }: HighlightsTabProps) {
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);

  const highlights = useLiveQuery(
    async () => {
      if (!currentDocumentId) return [];
      return await highlightHelpers.getHighlightsByDocument(currentDocumentId);
    },
    [currentDocumentId]
  );

  const handleDeleteHighlight = async (highlightId: string) => {
    await highlightHelpers.delete(highlightId);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'REMOVE_HIGHLIGHT',
          highlightId,
        });
      }
    });
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
        {!highlights || highlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <Highlighter className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-600 font-medium mb-1">No highlights yet</p>
            <p className="text-xs text-gray-400 mb-3">
              Select text on the page to create highlights
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-md text-xs text-gray-600">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono">⌘⇧L</kbd>
              <span>to highlight</span>
            </div>
          </div>
        ) : (
          highlights.map((highlight) => (
            <div
              key={highlight.id}
              className={`group bg-white border rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer ${
                selectedHighlightId === highlight.id ? 'border-gray-900 shadow-sm' : 'border-gray-200'
              }`}
              onClick={() => setSelectedHighlightId(highlight.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 leading-relaxed">
                    "{highlight.quote_text}"
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDate(highlight.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteHighlight(highlight.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-100 rounded transition-all text-gray-400 hover:text-red-600"
                  title="Delete highlight"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {highlight.color && (
                <div
                  className="w-full h-1 rounded-full mt-2.5"
                  style={{ backgroundColor: highlight.color }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
