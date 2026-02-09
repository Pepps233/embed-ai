import React from 'react';
import { createRoot } from 'react-dom/client';
import PDFViewerApp from './App';
import './pdf-viewer.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <PDFViewerApp />
    </React.StrictMode>
  );
}
