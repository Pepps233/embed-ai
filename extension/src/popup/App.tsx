import { useState, useEffect } from 'react';
import { BookOpen, FileText } from 'lucide-react';

function App() {
  const [isPDF, setIsPDF] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    // Get current tab and check if it's a PDF
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        setCurrentUrl(tab.url);
        // Check if URL ends with .pdf or content type is PDF
        const url = tab.url.toLowerCase();
        if (url.endsWith('.pdf') || url.includes('.pdf?')) {
          setIsPDF(true);
        }
      }
    });
  }, []);

  const openPDFViewer = () => {
    if (!currentUrl) return;
    const viewerUrl = chrome.runtime.getURL('src/pdf-viewer/index.html');
    const fullUrl = `${viewerUrl}?url=${encodeURIComponent(currentUrl)}`;
    chrome.tabs.create({ url: fullUrl });
  };

  return (
    <div className="w-80 p-4 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-800">Embed AI</h1>
      </div>

      <div className="space-y-3">
        {isPDF && (
          <button
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
            onClick={openPDFViewer}
          >
            <FileText className="w-4 h-4" />
            Open PDF in Embed AI
          </button>
        )}

        <button
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          onClick={() => chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })}
        >
          Open Side Panel
        </button>

        <div className="text-sm text-gray-600">
          {isPDF ? (
            <p>Open this PDF in Embed AI to highlight text and take notes.</p>
          ) : (
            <p>Start reading and annotating web pages and PDFs.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
