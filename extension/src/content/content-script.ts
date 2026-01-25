/**
 * Content Script - DOM layer logics
 * Injected into web pages to enable reading and annotation
 */

import { documentHelpers, pageTextHelpers } from '../lib/db-helpers';
import { extractPageText, extractPageMetadata } from '../services/text-extraction';
import {
  createHighlightFromSelection,
  restoreHighlights,
  removeHighlight,
} from '../services/highlight-manager';
import { DocumentType, ProcessingStatus } from '@shared/types';

console.log('Embed AI loaded');

let currentDocumentId: string | null = null;
let isInitialized = false;

/**
 * Initialize content script
 */
async function initialize() {
  if (isInitialized) return;
  
  console.log('Embed AI loaded: Initializing content script');
  
  try {
    // Get or create document for current page
    currentDocumentId = await getOrCreateDocument();
    
    // Restore existing highlights
    if (currentDocumentId) {
      await restoreHighlights(currentDocumentId);
    }
    
    // Set up event listeners
    setupEventListeners();
    
    isInitialized = true;
    console.log('Embed AI: Initialized', { documentId: currentDocumentId });
  } catch (error) {
    console.error('Embed AI: Initialization failed', error);
  }
}

/**
 * Get or create document for current page
 */
async function getOrCreateDocument(): Promise<string> {
  const url = window.location.href;
  
  // Check if document already exists
  let doc = await documentHelpers.getBySource(url);
  
  if (!doc) {
    // Extract page metadata
    const metadata = extractPageMetadata();
    
    // Create new document
    const docId = await documentHelpers.create({
      type: DocumentType.WEB_PAGE,
      source: url,
      title: metadata.title,
      author: metadata.author,
      status: ProcessingStatus.LOCAL,
      metadata: {
        description: metadata.description,
        domain: metadata.domain,
        publishedDate: metadata.publishedDate,
      },
    });
    
    // Extract and store page text
    await extractAndStorePageText(docId);
    
    return docId;
  }
  
  return doc.id;
}

/**
 * Extract and store page text in IndexedDB
 */
async function extractAndStorePageText(documentId: string): Promise<void> {
  const extractedText = extractPageText();
  
  // Store as single page (page 0 for web pages)
  const fullText = extractedText.map(t => t.text).join(' ');
  
  await pageTextHelpers.create({
    document_id: documentId,
    page_number: 0,
    text: fullText,
    char_start: 0,
    char_end: fullText.length,
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Listen for text selection (for highlighting)
  document.addEventListener('mouseup', handleTextSelection);
  
  // Listen for keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcut);
}

/**
 * Handle text selection for highlighting
 */
function handleTextSelection(event: MouseEvent) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;
  
  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < 3) return;
  
  // Check if selection is within an existing highlight
  if (isSelectionWithinHighlight(selection)) {
    return; // Don't show UI for selections within existing highlights
  }
  
  // Show highlight button near selection
  showHighlightButton(event.clientX, event.clientY);
}

/**
 * Check if selection is entirely within an existing highlight
 */
function isSelectionWithinHighlight(selection: Selection): boolean {
  if (!selection.rangeCount) return false;
  
  const range = selection.getRangeAt(0);
  let node: Node | null = range.commonAncestorContainer;
  
  // Walk up the DOM tree to check if we're inside a highlight
  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (element.classList.contains('kc-highlight')) {
        return true;
      }
    }
    node = node.parentNode;
  }
  
  return false;
}

/**
 * Show highlight/note popup menu near selection
 */
function showHighlightButton(x: number, y: number) {
  // Remove existing popup
  const existing = document.getElementById('kc-action-popup');
  if (existing) existing.remove();
  
  const popup = document.createElement('div');
  popup.id = 'kc-action-popup';
  popup.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y - 90}px;
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
  highlightBtn.style.cssText = `
    display: block;
    width: 140px;
    padding: 10px 16px;
    background: white;
    color: #374151;
    border: none;
    border-bottom: 1px solid #e5e7eb;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  `;
  highlightBtn.onmouseover = () => highlightBtn.style.background = '#f3f4f6';
  highlightBtn.onmouseout = () => highlightBtn.style.background = 'white';
  highlightBtn.addEventListener('click', async () => {
    if (!currentDocumentId) return;
    await createHighlightFromSelection(currentDocumentId, '#FFFF0080'); // Light yellow with opacity
    popup.remove();
  });
  
  // Note button
  const noteBtn = document.createElement('button');
  noteBtn.textContent = 'Create Note';
  noteBtn.style.cssText = `
    display: block;
    width: 140px;
    padding: 10px 16px;
    background: white;
    color: #374151;
    border: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  `;
  noteBtn.onmouseover = () => noteBtn.style.background = '#f3f4f6';
  noteBtn.onmouseout = () => noteBtn.style.background = 'white';
  noteBtn.addEventListener('click', async () => {
    if (!currentDocumentId) return;
    await createHighlightFromSelection(currentDocumentId, '#E9D5FF80'); // Light purple with opacity
    popup.remove();
    // Open side panel to notes tab
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  });
  
  popup.appendChild(highlightBtn);
  popup.appendChild(noteBtn);
  document.body.appendChild(popup);
  
  // Remove popup after 5 seconds or on click outside
  setTimeout(() => popup.remove(), 5000);
  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target as Node)) popup.remove();
  }, { once: true });
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcut(event: KeyboardEvent) {
  const isCmdOrCtrl = event.metaKey || event.ctrlKey;
  
  // Cmd/Ctrl + Shift + L: Create highlight
  if (isCmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    if (!currentDocumentId) return;
    createHighlightFromSelection(currentDocumentId);
  }

  // Cmd/Ctrl + Shift + K: Toggle side panel
  if (isCmdOrCtrl && event.shiftKey && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL' });
  }
}

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'GET_DOCUMENT_ID':
          sendResponse({ documentId: currentDocumentId });
          break;
          
        case 'EXTRACT_TEXT':
          const text = extractPageText();
          sendResponse({ text });
          break;
          
        case 'CREATE_HIGHLIGHT':
          if (currentDocumentId) {
            const highlightId = await createHighlightFromSelection(currentDocumentId, message.color);
            sendResponse({ highlightId });
          }
          break;
          
        case 'REMOVE_HIGHLIGHT':
          // removes highlight from DOM
          await removeHighlight(message.highlightId);
          sendResponse({ success: true });
          break;
          
        case 'RESTORE_HIGHLIGHTS':
          if (currentDocumentId) {
            await restoreHighlights(currentDocumentId);
            sendResponse({ success: true });
          }
          break;
          
        case 'REINITIALIZE':
          isInitialized = false;
          await initialize();
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({ error: (error as Error).message });
    }
  })();
  
  return true; // Keep channel open for async response
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
