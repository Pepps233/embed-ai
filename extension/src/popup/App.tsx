import { BookOpen } from 'lucide-react';

function App() {
  return (
    <div className="w-80 p-4 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-800">Embed AI</h1>
      </div>
      
      <div className="space-y-3">
        <button 
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          onClick={() => chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })}
        >
          Open Side Panel
        </button>
        
        <div className="text-sm text-gray-600">
          <p>Start reading and annotating web pages and PDFs.</p>
        </div>
      </div>
    </div>
  );
}

export default App;
