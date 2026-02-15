/**
 * Inline PDF Viewer - Vanilla TS module
 * Renders PDF directly in page DOM from content script context.
 * Replaces the iframe+React approach to fix rendering bugs.
 */

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

/**
 * Activate the inline PDF viewer, replacing the current page content.
 */
export async function activateInlinePDFViewer(): Promise<void> {
  const pdfUrl = window.location.href;

  // Clear the page and inject our viewer shell
  document.documentElement.innerHTML = '';

  const head = document.createElement('head');
  const meta = document.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  head.appendChild(meta);

  const titleEl = document.createElement('title');
  titleEl.textContent = 'Embed AI \u2013 PDF Viewer';
  head.appendChild(titleEl);

  // Load CSS from web_accessible_resources
  await injectCSS(head);

  document.documentElement.appendChild(head);

  const body = document.createElement('body');
  document.documentElement.appendChild(body);

  // Build viewer DOM
  const viewer = document.createElement('div');
  viewer.className = 'pdf-viewer';

  // Header (populated after metadata loads)
  const header = document.createElement('header');
  header.className = 'pdf-header';
  viewer.appendChild(header);

  // Scrollable container
  const container = document.createElement('div');
  container.className = 'pdf-container';
  viewer.appendChild(container);

  body.appendChild(viewer);

  // Show loading state
  const loadingEl = createLoadingElement();
  container.appendChild(loadingEl);

  try {
    // Check if document already exists
    const existingDoc = await sendMessage<any>({
      type: 'GET_DOCUMENT_BY_SOURCE',
      source: pdfUrl,
    });

    let documentId: string;
    let pdf: PDFDocumentProxy;
    let metadata: PDFMetadata;

    if (existingDoc?.document) {
      documentId = existingDoc.document.id;
      pdf = await loadPDF(pdfUrl);
      metadata = await getPDFMetadata(pdf);
    } else {
      // Load PDF
      pdf = await loadPDF(pdfUrl);
      metadata = await getPDFMetadata(pdf);

      // Create document in DB
      const filename = getFilenameFromUrl(pdfUrl);
      const createResp = await sendMessage<{ documentId: string }>({
        type: 'CREATE_DOCUMENT',
        payload: {
          type: DocumentType.PDF,
          source: pdfUrl,
          title: metadata.title || filename,
          author: metadata.author,
          status: ProcessingStatus.LOCAL,
          metadata: {
            pageCount: metadata.pageCount,
            filename,
          },
        },
      });
      documentId = createResp.documentId;

      // Extract and store page text
      const pages = await extractAllPagesText(pdf, (page, total) => {
        loadingEl.textContent = `Extracting page ${page} of ${total}...`;
      });

      for (const page of pages) {
        await sendMessage({
          type: 'CREATE_PAGE_TEXT',
          payload: {
            document_id: documentId,
            page_number: page.pageNumber,
            text: page.text,
            char_start: page.charStart,
            char_end: page.charEnd,
          },
        });
      }
    }

    // Store document ID for sidepanel
    chrome.storage.session.set({ currentPdfDocumentId: documentId });
    chrome.runtime.sendMessage({ type: 'PDF_DOCUMENT_LOADED', documentId });
    (window as any).__currentDocumentId = documentId;
    (window as any).__isPDFViewer = true;

    // Populate header
    buildHeader(header, metadata, pdf.numPages, container);

    // Remove loading indicator
    loadingEl.remove();

    // Create page placeholders
    const pageElements = new Map<number, HTMLDivElement>();
    for (let i = 1; i <= pdf.numPages; i++) {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page';
      pageDiv.setAttribute('data-page', String(i));

      const placeholder = document.createElement('div');
      placeholder.className = 'page-placeholder';
      placeholder.textContent = `Loading page ${i}...`;
      pageDiv.appendChild(placeholder);

      container.appendChild(pageDiv);
      pageElements.set(i, pageDiv);
    }

    // Lazy-render pages with IntersectionObserver
    const renderedPages = new Set<number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
          if (pageNum > 0 && !renderedPages.has(pageNum)) {
            renderedPages.add(pageNum);
            renderPage(pdf, pageNum, pageElements.get(pageNum)!);
          }
        }
      },
      { root: container, rootMargin: '200px', threshold: 0.1 }
    );

    pageElements.forEach((el) => observer.observe(el));

    // Restore existing highlights
    const hlResp = await sendMessage<{ highlights: any[] }>({
      type: 'GET_HIGHLIGHTS_BY_DOCUMENT',
      documentId,
    });
    if (hlResp?.highlights?.length) {
      (window as any).__pendingHighlights = hlResp.highlights;
    }

    // Set up text selection handler
    setupTextSelection(documentId);

    // Set up keyboard shortcuts
    setupKeyboardShortcuts(documentId);
  } catch (err) {
    console.error('Error loading PDF:', err);
    loadingEl.remove();
    const errorEl = document.createElement('div');
    errorEl.className = 'pdf-error';
    errorEl.innerHTML = `<h2>Error Loading PDF</h2><p>${(err as Error).message}</p>`;
    container.appendChild(errorEl);
  }
}

// ============================================================================
// Helper: send chrome.runtime message as Promise
// ============================================================================

function sendMessage<T = any>(msg: any): Promise<T> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => resolve(response));
  });
}

// ============================================================================
// CSS injection
// ============================================================================

async function injectCSS(head: HTMLElement): Promise<void> {
  try {
    const cssUrl = chrome.runtime.getURL('src/pdf-viewer/pdf-viewer.css');
    const resp = await fetch(cssUrl);
    const cssText = await resp.text();
    const style = document.createElement('style');
    style.textContent = cssText;
    head.appendChild(style);
  } catch (e) {
    console.warn('Embed AI: Could not load PDF viewer CSS', e);
  }
}

// ============================================================================
// Loading element
// ============================================================================

function createLoadingElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'pdf-loading';
  el.innerHTML = '<div class="spinner"></div>';
  const p = document.createElement('p');
  p.textContent = 'Loading PDF...';
  el.appendChild(p);
  return el;
}

// ============================================================================
// Header
// ============================================================================

function buildHeader(
  header: HTMLElement,
  metadata: PDFMetadata,
  numPages: number,
  container: HTMLElement
) {
  // Title section
  const titleDiv = document.createElement('div');
  titleDiv.className = 'pdf-title';

  const h1 = document.createElement('h1');
  h1.textContent = metadata.title || 'PDF Document';
  titleDiv.appendChild(h1);

  if (metadata.author) {
    const authorSpan = document.createElement('span');
    authorSpan.className = 'pdf-author';
    authorSpan.textContent = `by ${metadata.author}`;
    titleDiv.appendChild(authorSpan);
  }

  header.appendChild(titleDiv);

  // Controls section
  const controls = document.createElement('div');
  controls.className = 'pdf-controls';

  let currentPage = 1;

  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Previous';
  prevBtn.disabled = true;

  const pageIndicator = document.createElement('span');
  pageIndicator.className = 'page-indicator';

  const pageInput = document.createElement('input');
  pageInput.type = 'number';
  pageInput.value = '1';
  pageInput.min = '1';
  pageInput.max = String(numPages);

  pageIndicator.appendChild(document.createTextNode('Page '));
  pageIndicator.appendChild(pageInput);
  pageIndicator.appendChild(document.createTextNode(` of ${numPages}`));

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.disabled = numPages <= 1;

  const sidePanelBtn = document.createElement('button');
  sidePanelBtn.className = 'sidepanel-btn';
  sidePanelBtn.textContent = 'Open Notes';

  function goToPage(page: number) {
    if (page < 1 || page > numPages) return;
    currentPage = page;
    pageInput.value = String(page);
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= numPages;

    const pages = container.querySelectorAll('.pdf-page');
    const target = pages[page - 1];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
  nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
  pageInput.addEventListener('change', () => goToPage(parseInt(pageInput.value) || 1));
  sidePanelBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  });

  controls.appendChild(prevBtn);
  controls.appendChild(pageIndicator);
  controls.appendChild(nextBtn);
  controls.appendChild(sidePanelBtn);

  header.appendChild(controls);
}

// ============================================================================
// Page rendering
// ============================================================================

async function renderPage(
  pdf: PDFDocumentProxy,
  pageNum: number,
  pageContainer: HTMLDivElement
): Promise<void> {
  try {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: SCALE });

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-canvas';
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d')!;
    await page.render({
      canvasContext: context,
      viewport,
      canvas,
    }).promise;

    // Clear placeholder
    pageContainer.innerHTML = '';
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;
    pageContainer.appendChild(canvas);

    // Create text layer
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
    pageContainer.appendChild(textLayerDiv);

    const textContent = await page.getTextContent();
    const textLayer = new TextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport,
    });
    await textLayer.render();
  } catch (err) {
    console.error(`Error rendering page ${pageNum}:`, err);
  }
}

// ============================================================================
// Text selection → highlight / note popups
// ============================================================================

function setupTextSelection(documentId: string) {
  document.addEventListener('mouseup', (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.closest('#pdf-action-popup') || target.closest('#pdf-note-input')) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 3) return;

    if (isSelectionWithinHighlight(selection)) return;

    showActionPopup(selection, documentId);
  });
}

function isSelectionWithinHighlight(selection: Selection): boolean {
  if (!selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  let node: Node | null = range.commonAncestorContainer;
  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).classList.contains('pdf-highlight')) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
}

function showActionPopup(selection: Selection, documentId: string) {
  const existing = document.getElementById('pdf-action-popup');
  if (existing) existing.remove();

  const range = selection.getRangeAt(0).cloneRange();
  const rect = range.getBoundingClientRect();

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
    if (sel && sel.rangeCount === 0) sel.addRange(range.cloneRange());
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

  const clickHandler = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node)) removePopup();
  };
  setTimeout(() => document.addEventListener('click', clickHandler), 100);
  const timeoutId = setTimeout(() => removePopup(), 5000);

  function removePopup() {
    if (popup.parentNode) {
      popup.remove();
      document.removeEventListener('click', clickHandler);
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================================
// Highlight creation and rendering
// ============================================================================

async function createPDFHighlight(documentId: string, color: string): Promise<string | null> {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return null;

  const quoteText = range.toString().trim();
  if (!quoteText) return null;

  const pageElement = range.commonAncestorContainer.parentElement?.closest('.pdf-page');
  const pageNumber = pageElement ? parseInt(pageElement.getAttribute('data-page') || '0') : 0;

  const anchor = {
    start_offset: 0,
    end_offset: quoteText.length,
    start_context: getContext(range, 'start'),
    end_context: getContext(range, 'end'),
    page_number: pageNumber,
    quote_text: quoteText,
  };

  const resp = await sendMessage<{ id: string }>({
    type: 'PERSIST_HIGHLIGHT',
    payload: {
      document_id: documentId,
      anchor,
      quote_text: quoteText,
      color,
    },
  });
  const highlightId = resp.id;

  renderPDFHighlight(highlightId, range, color);
  selection.removeAllRanges();

  chrome.runtime.sendMessage({ type: 'HIGHLIGHT_CREATED', documentId });

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
  noteBtn.addEventListener('click', () => {
    const docId = (window as any).__currentDocumentId;
    if (docId) showNoteInput(highlightId, docId, rect);
    menu.remove();
  });

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove Highlight';
  removeBtn.className = 'popup-btn popup-btn-danger';
  removeBtn.addEventListener('click', async () => {
    await sendMessage({ type: 'DELETE_HIGHLIGHT', highlightId });
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

// ============================================================================
// Note input
// ============================================================================

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
    await sendMessage({
      type: 'PERSIST_NOTE',
      payload: {
        document_id: documentId,
        highlight_id: highlightId || undefined,
        content,
        metadata: { tags: [], type: 'summary', created_from: 'manual' },
      },
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

// ============================================================================
// Keyboard shortcuts
// ============================================================================

function setupKeyboardShortcuts(documentId: string) {
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const isCmdOrCtrl = event.metaKey || event.ctrlKey;

    // Cmd/Ctrl + Shift + L: Create highlight
    if (isCmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        createPDFHighlight(documentId, '#FFFF0080');
      }
    }

    // Cmd/Ctrl + Shift + K: Toggle side panel
    if (isCmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL' });
    }
  });
}

// ============================================================================
// Context extraction for anchoring
// ============================================================================

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
