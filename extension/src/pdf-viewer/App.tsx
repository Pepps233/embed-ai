/**
 * PDF Viewer App - Renders PDFs with text layer for highlighting
 * Phase 2.1 - PDF support
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { TextLayer } from 'pdfjs-dist';
import {
  loadPDF,
  extractAllPagesText,
  getPDFMetadata,
  getFilenameFromUrl,
  type PDFMetadata,
} from '../services/pdf-service';
import { DocumentType, ProcessingStatus } from '@shared/types';

const SCALE = 1.5;

interface PageRenderState {
  rendered: boolean;
  textLayerRendered: boolean;
}

export default function PDFViewerApp() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [metadata, setMetadata] = useState<PDFMetadata | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [pageStates, setPageStates] = useState<Map<number, PageRenderState>>(new Map());

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Get PDF URL from query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    if (url) {
      setPdfUrl(decodeURIComponent(url));
    } else {
      setError('No PDF URL provided');
      setLoading(false);
    }
  }, []);

  // Load PDF and extract text
  useEffect(() => {
    if (!pdfUrl) return;

    let cancelled = false;

    async function loadAndProcess() {
      try {
        setLoading(true);
        setError(null);

        // Check if document already exists
        const existingDoc = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_DOCUMENT_BY_SOURCE', source: pdfUrl },
            (response) => resolve(response?.document)
          );
        });

        if (existingDoc) {
          setDocumentId(existingDoc.id);
          // Load PDF for viewing
          const pdfDoc = await loadPDF(pdfUrl!);
          if (cancelled) return;
          setPdf(pdfDoc);

          const meta = await getPDFMetadata(pdfDoc);
          setMetadata(meta);

          // Restore highlights
          await restoreHighlights(existingDoc.id);

          setLoading(false);
          return;
        }

        // Load PDF
        const pdfDoc = await loadPDF(pdfUrl!);
        if (cancelled) return;
        setPdf(pdfDoc);

        // Get metadata
        const meta = await getPDFMetadata(pdfDoc);
        setMetadata(meta);

        // Create document in DB
        const filename = getFilenameFromUrl(pdfUrl!);
        const docId = await new Promise<string>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'CREATE_DOCUMENT',
              payload: {
                type: DocumentType.PDF,
                source: pdfUrl,
                title: meta.title || filename,
                author: meta.author,
                status: ProcessingStatus.LOCAL,
                metadata: {
                  pageCount: meta.pageCount,
                  filename,
                },
              },
            },
            (response) => resolve(response.documentId)
          );
        });

        if (cancelled) return;
        setDocumentId(docId);

        // Extract and store page text
        setExtractionProgress('Extracting text...');
        const pages = await extractAllPagesText(pdfDoc, (page, total) => {
          setExtractionProgress(`Extracting page ${page} of ${total}...`);
        });

        // Store all page texts
        for (const page of pages) {
          if (cancelled) return;
          await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'CREATE_PAGE_TEXT',
                payload: {
                  document_id: docId,
                  page_number: page.pageNumber,
                  text: page.text,
                  char_start: page.charStart,
                  char_end: page.charEnd,
                },
              },
              resolve
            );
          });
        }

        setExtractionProgress(null);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading PDF:', err);
        setError((err as Error).message);
        setLoading(false);
      }
    }

    loadAndProcess();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Store document ID in session storage for sidepanel
  useEffect(() => {
    if (documentId) {
      // Store in session storage for sidepanel to access
      chrome.storage.session.set({ currentPdfDocumentId: documentId });

      // Also send a message for any open sidepanels
      chrome.runtime.sendMessage({
        type: 'PDF_DOCUMENT_LOADED',
        documentId,
      });
    }

    // Cleanup on unmount
    return () => {
      chrome.storage.session.remove('currentPdfDocumentId');
    };
  }, [documentId]);

  // Render pages as they come into view
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdf) return;

      const pageContainer = pageRefs.current.get(pageNum);
      if (!pageContainer) return;

      const state = pageStates.get(pageNum);
      if (state?.rendered) return;

      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: SCALE });

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d')!;

        // Render page to canvas
        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise;

        // Clear previous content
        pageContainer.innerHTML = '';
        pageContainer.style.width = `${viewport.width}px`;
        pageContainer.style.height = `${viewport.height}px`;
        pageContainer.appendChild(canvas);

        // Create text layer container
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        pageContainer.appendChild(textLayerDiv);

        // Render text layer for selection
        const textContent = await page.getTextContent();
        const textLayer = new TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport,
        });
        await textLayer.render();

        // Update state
        setPageStates((prev) => {
          const next = new Map(prev);
          next.set(pageNum, { rendered: true, textLayerRendered: true });
          return next;
        });
      } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    },
    [pdf, pageStates]
  );

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!pdf || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
            if (pageNum > 0) {
              renderPage(pageNum);
            }
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    // Observe all page containers
    pageRefs.current.forEach((el, pageNum) => {
      el.setAttribute('data-page', pageNum.toString());
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pdf, loading, renderPage]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;

      // Cmd/Ctrl + Shift + K: Toggle side panel
      if (isCmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL' });
      }

      // Cmd/Ctrl + Shift + L: Create highlight (if text is selected)
      if (isCmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        if (documentId) {
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed) {
            createPDFHighlight(documentId, '#FFFF0080');
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [documentId]);

  // Handle text selection for highlighting
  useEffect(() => {
    if (!documentId) {
      console.log('PDF Viewer: Waiting for documentId before registering text selection handler');
      return;
    }

    console.log('PDF Viewer: Registering text selection handler with documentId:', documentId);

    // Store document ID for highlight manager
    (window as any).__currentDocumentId = documentId;
    (window as any).__isPDFViewer = true;

    const handleMouseUp = async (e: MouseEvent) => {
      console.log('PDF Viewer: mouseup event detected');

      // Don't show popup if clicking on our UI elements
      const target = e.target as Element;
      if (target.closest('#pdf-action-popup') || target.closest('#pdf-note-input')) {
        console.log('PDF Viewer: Click on popup, ignoring');
        return;
      }

      const selection = window.getSelection();
      console.log('PDF Viewer: Selection:', selection);

      if (!selection || selection.isCollapsed) {
        console.log('PDF Viewer: No selection or collapsed');
        return;
      }

      const selectedText = selection.toString().trim();
      console.log('PDF Viewer: Selected text:', selectedText);

      if (!selectedText || selectedText.length < 3) {
        console.log('PDF Viewer: Text too short');
        return;
      }

      // Check if selection is within existing highlight
      if (isSelectionWithinHighlight(selection)) {
        console.log('PDF Viewer: Selection within existing highlight');
        return;
      }

      console.log('PDF Viewer: Showing action popup');
      // Show action popup
      showActionPopup(selection, documentId);
    };

    document.addEventListener('mouseup', handleMouseUp);
    console.log('PDF Viewer: Text selection handler registered');

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      console.log('PDF Viewer: Text selection handler unregistered');
    };
  }, [documentId]);

  // Restore highlights from DB
  async function restoreHighlights(docId: string) {
    const highlights = await new Promise<any[]>((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_HIGHLIGHTS_BY_DOCUMENT', documentId: docId },
        (response) => resolve(response?.highlights || [])
      );
    });

    // We'll render highlights after pages are rendered
    // Store them for later application
    (window as any).__pendingHighlights = highlights;
  }

  // Go to specific page
  const goToPage = (page: number) => {
    if (page < 1 || (metadata && page > metadata.pageCount)) return;
    setCurrentPage(page);

    const pageEl = pageRefs.current.get(page);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (error) {
    return (
      <div className="pdf-error">
        <h2>Error Loading PDF</h2>
        <p>{error}</p>
        <button onClick={() => window.close()}>Close</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pdf-loading">
        <div className="spinner"></div>
        <p>{extractionProgress || 'Loading PDF...'}</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <header className="pdf-header">
        <div className="pdf-title">
          <h1>{metadata?.title || 'PDF Document'}</h1>
          {metadata?.author && <span className="pdf-author">by {metadata.author}</span>}
        </div>
        <div className="pdf-controls">
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
            Previous
          </button>
          <span className="page-indicator">
            Page{' '}
            <input
              type="number"
              value={currentPage}
              min={1}
              max={metadata?.pageCount || 1}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
            />{' '}
            of {metadata?.pageCount || 1}
          </span>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={!metadata || currentPage >= metadata.pageCount}
          >
            Next
          </button>
          <button
            className="sidepanel-btn"
            onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' })}
          >
            Open Notes
          </button>
        </div>
      </header>

      <div className="pdf-container" ref={containerRef}>
        {pdf &&
          Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => {
                if (el) pageRefs.current.set(pageNum, el);
              }}
              className="pdf-page"
              data-page={pageNum}
            >
              <div className="page-placeholder">Loading page {pageNum}...</div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ============================================================================
// Highlight Helper Functions
// ============================================================================

function isSelectionWithinHighlight(selection: Selection): boolean {
  if (!selection.rangeCount) return false;

  const range = selection.getRangeAt(0);
  let node: Node | null = range.commonAncestorContainer;

  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (element.classList.contains('pdf-highlight')) {
        return true;
      }
    }
    node = node.parentNode;
  }

  return false;
}

function showActionPopup(selection: Selection, documentId: string) {
  console.log('showActionPopup called with documentId:', documentId);

  // Remove existing popup
  const existing = document.getElementById('pdf-action-popup');
  if (existing) {
    console.log('Removing existing popup');
    existing.remove();
  }

  const range = selection.getRangeAt(0).cloneRange();
  const rect = range.getBoundingClientRect();
  console.log('Selection rect:', rect);

  const popup = document.createElement('div');
  popup.id = 'pdf-action-popup';
  popup.style.cssText = `
    position: fixed;
    left: ${rect.right}px;
    top: ${Math.max(5, rect.top - 85)}px;
    z-index: 999999;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    overflow: hidden;
    font-family: 'Source Sans 3', sans-serif;
  `;
  console.log('Popup created with styles:', popup.style.cssText);

  // Highlight button
  const highlightBtn = document.createElement('button');
  highlightBtn.textContent = 'Highlight Text';
  highlightBtn.className = 'popup-btn';
  highlightBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  highlightBtn.addEventListener('click', async (e) => {
    e.stopPropagation();

    const sel = window.getSelection();
    if (sel && sel.rangeCount === 0) {
      sel.addRange(range.cloneRange());
    }

    await createPDFHighlight(documentId, '#FFFF0080');
    removePopup();
  });

  // Note button
  const noteBtn = document.createElement('button');
  noteBtn.textContent = 'Create Note';
  noteBtn.className = 'popup-btn';
  noteBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  noteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range.cloneRange());
    }

    const highlightId = await createPDFHighlight(documentId, '#E9D5FF80');
    showNoteInput(highlightId, documentId, rect);
    removePopup();
  });

  popup.appendChild(highlightBtn);
  popup.appendChild(noteBtn);
  document.body.appendChild(popup);
  console.log('Popup appended to body, element:', popup);
  console.log('Popup in DOM:', document.getElementById('pdf-action-popup'));

  // Close handlers
  const clickHandler = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node)) {
      console.log('Click outside popup, removing');
      removePopup();
    }
  };

  setTimeout(() => document.addEventListener('click', clickHandler), 100);
  const timeoutId = setTimeout(() => {
    console.log('Popup timeout, auto-removing');
    removePopup();
  }, 5000);

  function removePopup() {
    if (popup.parentNode) {
      console.log('Removing popup');
      popup.remove();
      document.removeEventListener('click', clickHandler);
      clearTimeout(timeoutId);
    }
  }
}

async function createPDFHighlight(documentId: string, color: string): Promise<string | null> {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return null;

  const quoteText = range.toString().trim();
  if (!quoteText) return null;

  // Get page number from selection
  const pageElement = range.commonAncestorContainer.parentElement?.closest('.pdf-page');
  const pageNumber = pageElement ? parseInt(pageElement.getAttribute('data-page') || '0') : 0;

  // Create anchor with PDF-specific data
  const anchor = {
    start_offset: 0, // We'll use text matching for PDFs
    end_offset: quoteText.length,
    start_context: getContext(range, 'start'),
    end_context: getContext(range, 'end'),
    page_number: pageNumber,
    quote_text: quoteText,
  };

  // Persist highlight
  const highlightId = await new Promise<string>((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: 'PERSIST_HIGHLIGHT',
        payload: {
          document_id: documentId,
          anchor,
          quote_text: quoteText,
          color,
        },
      },
      (response) => resolve(response.id)
    );
  });

  // Render highlight in DOM
  renderPDFHighlight(highlightId, range, color);

  // Clear selection
  selection.removeAllRanges();

  // Notify side panel
  chrome.runtime.sendMessage({
    type: 'HIGHLIGHT_CREATED',
    documentId,
  });

  return highlightId;
}

function renderPDFHighlight(highlightId: string, range: Range, color: string) {
  const span = document.createElement('span');
  span.className = 'pdf-highlight';
  span.setAttribute('data-highlight-id', highlightId);
  span.style.backgroundColor = color;
  span.style.cursor = 'pointer';

  try {
    range.surroundContents(span);
  } catch {
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
  }

  // Add click handler
  span.addEventListener('click', (e) => {
    e.stopPropagation();
    showHighlightMenu(highlightId, span);
  });
}

function showHighlightMenu(highlightId: string, element: Element) {
  const existing = document.getElementById('pdf-highlight-menu');
  if (existing) existing.remove();

  const rect = element.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'pdf-highlight-menu';
  menu.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.bottom + 5}px;
    z-index: 999999;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    overflow: hidden;
    font-family: 'Source Sans 3', sans-serif;
  `;

  // Add Note button
  const noteBtn = document.createElement('button');
  noteBtn.textContent = 'Add Note';
  noteBtn.className = 'popup-btn';
  noteBtn.addEventListener('click', async () => {
    const documentId = (window as any).__currentDocumentId;
    if (documentId) {
      showNoteInput(highlightId, documentId, rect);
    }
    menu.remove();
  });

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove Highlight';
  removeBtn.className = 'popup-btn popup-btn-danger';
  removeBtn.addEventListener('click', async () => {
    // Delete from DB
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'DELETE_HIGHLIGHT', highlightId }, resolve);
    });

    // Remove from DOM
    const elements = document.querySelectorAll(`[data-highlight-id="${highlightId}"]`);
    elements.forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        parent.normalize();
      }
    });

    menu.remove();
  });

  menu.appendChild(noteBtn);
  menu.appendChild(removeBtn);
  document.body.appendChild(menu);

  // Close handler
  setTimeout(() => {
    const closeHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 0);

  setTimeout(() => menu.remove(), 5000);
}

function showNoteInput(highlightId: string | null, documentId: string, rect: DOMRect) {
  const existing = document.getElementById('pdf-note-input');
  if (existing) existing.remove();

  const notePopup = document.createElement('div');
  notePopup.id = 'pdf-note-input';
  notePopup.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.bottom + 5}px;
    z-index: 999999;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 12px;
    font-family: 'Source Sans 3', sans-serif;
    width: 280px;
  `;

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Write a note...';
  textarea.style.cssText = `
    width: 100%;
    min-height: 80px;
    padding: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 14px;
    font-family: 'Source Sans 3', sans-serif;
    resize: vertical;
    outline: none;
    margin-bottom: 8px;
    box-sizing: border-box;
  `;

  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Confirm';
  confirmBtn.className = 'note-btn note-btn-primary';
  confirmBtn.addEventListener('click', async () => {
    const content = textarea.value.trim();
    if (!content) {
      notePopup.remove();
      return;
    }

    await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'PERSIST_NOTE',
          payload: {
            document_id: documentId,
            highlight_id: highlightId || undefined,
            content,
            metadata: {
              tags: [],
              type: 'summary',
              created_from: 'manual',
            },
          },
        },
        resolve
      );
    });

    chrome.runtime.sendMessage({ type: 'NOTE_CREATED', documentId });
    notePopup.remove();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'note-btn';
  cancelBtn.addEventListener('click', () => notePopup.remove());

  btnContainer.appendChild(cancelBtn);
  btnContainer.appendChild(confirmBtn);
  notePopup.appendChild(textarea);
  notePopup.appendChild(btnContainer);
  document.body.appendChild(notePopup);

  textarea.focus();

  const clickHandler = (e: MouseEvent) => {
    if (!notePopup.contains(e.target as Node)) {
      notePopup.remove();
      document.removeEventListener('click', clickHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', clickHandler), 100);
}

function getContext(range: Range, position: 'start' | 'end'): string {
  const CONTEXT_LENGTH = 50;
  const container = position === 'start' ? range.startContainer : range.endContainer;
  const offset = position === 'start' ? range.startOffset : range.endOffset;

  if (container.nodeType !== Node.TEXT_NODE) return '';

  const text = container.textContent || '';

  if (position === 'start') {
    const start = Math.max(0, offset - CONTEXT_LENGTH);
    return text.substring(start, offset);
  } else {
    const end = Math.min(text.length, offset + CONTEXT_LENGTH);
    return text.substring(offset, end);
  }
}
