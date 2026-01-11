# Knowledge Companion Extension

Browser extension for reading, annotating, and querying web pages and PDFs.

## Features

- **Highlighting**: Select and highlight text on any webpage or PDF
- **Notes**: Attach structured notes to highlights with metadata
- **Local Storage**: IndexedDB for offline-first data persistence
- **PDF Support**: Read and annotate PDFs directly in browser
- **Question Answering**: Ask questions about your reading material
- **Sync**: Cloud sync for multi-device access

## Development

```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

## Loading in Chrome

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` directory

## Project Structure

```
src/
├── background/
│   └── service-worker.ts    # Background service worker
├── content/
│   ├── content-script.ts    # Content script injected into pages
│   └── content-script.css   # Highlight styles
├── popup/
│   ├── index.html          # Popup HTML
│   ├── main.tsx            # Popup entry point
│   └── App.tsx             # Popup React app
├── sidepanel/
│   ├── index.html          # Side panel HTML
│   ├── main.tsx            # Side panel entry point
│   └── App.tsx             # Side panel React app
├── lib/
│   ├── db.ts               # IndexedDB (Dexie) setup
│   └── utils.ts            # Utility functions
├── styles/
│   └── globals.css         # Global styles
└── manifest.json           # Extension manifest
```

## Architecture

### Local-First Design
- All data stored in IndexedDB
- Immediate UI updates
- Background sync to cloud

### Content Script
- Injected into all pages
- Handles text selection and highlighting
- Communicates with background worker

### Side Panel
- Main UI for viewing highlights and notes
- Question answering interface
- Document management

### Background Worker
- Coordinates between content scripts and side panel
- Manages API communication
- Handles sync operations

## Technologies

- **React**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool
- **Dexie.js**: IndexedDB wrapper
- **TailwindCSS**: Styling
- **Lucide React**: Icons
- **PDF.js**: PDF rendering and text extraction
