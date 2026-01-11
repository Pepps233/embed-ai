import React, { useState } from 'react';
import { BookOpen, Highlighter, MessageSquare, Search } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'highlights' | 'notes' | 'qa'>('highlights');

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <h1 className="text-lg font-bold text-gray-800">Knowledge Companion</h1>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 flex">
        <button
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 ${
            activeTab === 'highlights' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'
          }`}
          onClick={() => setActiveTab('highlights')}
        >
          <Highlighter className="w-4 h-4" />
          <span className="text-sm font-medium">Highlights</span>
        </button>
        <button
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 ${
            activeTab === 'notes' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'
          }`}
          onClick={() => setActiveTab('notes')}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-sm font-medium">Notes</span>
        </button>
        <button
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 ${
            activeTab === 'qa' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'
          }`}
          onClick={() => setActiveTab('qa')}
        >
          <Search className="w-4 h-4" />
          <span className="text-sm font-medium">Q&A</span>
        </button>
      </nav>

      <main className="flex-1 overflow-y-auto p-4">
        {activeTab === 'highlights' && (
          <div className="text-center text-gray-500 mt-8">
            <Highlighter className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No highlights yet</p>
            <p className="text-sm mt-1">Select text on the page to create highlights</p>
          </div>
        )}
        {activeTab === 'notes' && (
          <div className="text-center text-gray-500 mt-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No notes yet</p>
            <p className="text-sm mt-1">Add notes to your highlights</p>
          </div>
        )}
        {activeTab === 'qa' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Ask a question about what you're reading..."
              />
              <button className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                Ask Question
              </button>
            </div>
            <div className="text-center text-gray-500 text-sm">
              Q&A powered by AI - coming soon
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
