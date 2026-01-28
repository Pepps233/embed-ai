/**
 * Content Script - DOM layer logics
 * Injected into web pages to enable reading and annotation
 */

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
    
    // Store document ID globally for highlight manager to access
    (window as any).__currentDocumentId = currentDocumentId;
    
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
 * Get or create document for current page via background script
 */
async function getOrCreateDocument(): Promise<string> {
  const url = window.location.href;
  
  // Check if document already exists via background script
  const existingDoc = await new Promise<any>((resolve) => {
    chrome.runtime.sendMessage({
      type: 'GET_DOCUMENT_BY_SOURCE',
      source: url
    }, (response) => {
      resolve(response.document);
    });
  });
  
  if (existingDoc) {
    return existingDoc.id;
  }
  
  // Extract page metadata
  const metadata = extractPageMetadata();
  
  // Create new document via background script
  const docId = await new Promise<string>((resolve) => {
    chrome.runtime.sendMessage({
      type: 'CREATE_DOCUMENT',
      payload: {
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
      }
    }, (response) => {
      resolve(response.documentId);
    });
  });
  
  // Extract and store page text
  await extractAndStorePageText(docId);
  
  return docId;
}

/**
 * Extract and store page text in IndexedDB via background script
 */
async function extractAndStorePageText(documentId: string): Promise<void> {
  const extractedText = extractPageText();
  
  // Store as single page (page 0 for web pages)
  const fullText = extractedText.map(t => t.text).join(' ');
  
  await new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'CREATE_PAGE_TEXT',
      payload: {
        document_id: documentId,
        page_number: 0,
        text: fullText,
        char_start: 0,
        char_end: fullText.length,
      }
    }, resolve);
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
  // Don't show popup if clicking on the popup itself or note input
  const target = event.target as Element;
  if (target.closest('#kc-action-popup') || target.closest('#kc-note-input')) {
    return;
  }
  
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;
  
  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < 3) return;
  
  // Check if selection is within an existing highlight
  if (isSelectionWithinHighlight(selection)) {
    return; // Don't show UI for selections within existing highlights
  }
  
  // Show highlight button at the end of the selection
  showHighlightButton(selection);
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
function showHighlightButton(selection: Selection) {
  // Remove existing popup
  const existing = document.getElementById('kc-action-popup');
  if (existing) {
    existing.remove();
  }
  
  // Store the range before any operations
  const range = selection.getRangeAt(0).cloneRange();
  const rect = range.getBoundingClientRect();
  
  // Position popup above the end of the selection (above the last word)
  const x = rect.right;
  const y = rect.top;
  
  // Popup height estimate (2 buttons * ~40px each)
  const popupHeight = 80;
  
  const popup = document.createElement('div');
  popup.id = 'kc-action-popup';
  popup.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${Math.max(5, y - popupHeight - 5)}px;
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

  highlightBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  highlightBtn.onmouseover = () => {
    highlightBtn.style.background = '#f3f4f6';
  };
  highlightBtn.onmouseout = () => highlightBtn.style.background = 'white';

  highlightBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    if (!currentDocumentId) {
      return;
    }
    
    
    // Re-select the range to ensure selection is available
    const sel = window.getSelection();
    
    if (sel && sel.rangeCount === 0) {
      sel.addRange(range.cloneRange());
    }
    
    await createHighlightFromSelection(currentDocumentId, '#FFFF0080');
    removePopup();
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

  noteBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  noteBtn.onmouseover = () => {
    noteBtn.style.background = '#f3f4f6';
  };
  noteBtn.onmouseout = () => noteBtn.style.background = 'white';

  noteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    if (!currentDocumentId) {
      return;
    }
    
    
    // Re-select the range to ensure selection is available
    const sel = window.getSelection();
    
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range.cloneRange());
    }
    
    // Create highlight first
    const highlightId = await createHighlightFromSelection(currentDocumentId, '#E9D5FF80');
    
    // Show note input UI
    showNoteInput(highlightId, x, y, popupHeight);
    removePopup();
  });
  
  popup.appendChild(highlightBtn);
  popup.appendChild(noteBtn);
  document.body.appendChild(popup);
  
  // Setup click handler to close popup
  const clickHandler = (e: MouseEvent) => {
    const target = e.target as Node;
    // Close if clicking outside popup or on highlighted text
    if (!popup.contains(target) || (target as Element).classList?.contains('kc-highlight')) {
      removePopup();
    }
  };
  
  // Add click handler after a short delay
  setTimeout(() => {
    document.addEventListener('click', clickHandler);
  }, 100);
  
  // Auto-remove after 5 seconds
  const timeoutId = setTimeout(() => removePopup(), 5000);
  
  // Helper to remove popup and cleanup
  function removePopup() {
    if (popup.parentNode) {
      popup.remove();
      document.removeEventListener('click', clickHandler);
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Show note input UI
 */
function showNoteInput(highlightId: string | null, x: number, y: number, offsetHeight: number) {
  // Remove any existing note input
  const existing = document.getElementById('kc-note-input');
  if (existing) existing.remove();
  
  const notePopup = document.createElement('div');
  notePopup.id = 'kc-note-input';
  notePopup.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${Math.max(5, y - offsetHeight - 5)}px;
    z-index: 999999;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 12px;
    font-family: 'Source Sans 3', sans-serif;
    width: 280px;
  `;
  
  // Textarea
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
  `;
  textarea.addEventListener('focus', () => {
    textarea.style.borderColor = '#3b82f6';
  });
  textarea.addEventListener('blur', () => {
    textarea.style.borderColor = '#e5e7eb';
  });
  
  // Button container
  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';
  
  // Confirm button
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Confirm';
  confirmBtn.style.cssText = `
    padding: 6px 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  `;
  confirmBtn.onmouseover = () => confirmBtn.style.background = '#2563eb';
  confirmBtn.onmouseout = () => confirmBtn.style.background = '#3b82f6';
  confirmBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const content = textarea.value.trim();
    if (!content || !currentDocumentId) {
      notePopup.remove();
      return;
    }
    
    // Create note via background script
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'PERSIST_NOTE',
        payload: {
          document_id: currentDocumentId,
          highlight_id: highlightId || undefined,
          content,
          metadata: {
            tags: [],
            type: 'summary',
            created_from: 'manual'
          }
        }
      }, resolve);
    });
    
    // Notify side panel to refresh
    chrome.runtime.sendMessage({ 
      type: 'NOTE_CREATED',
      documentId: currentDocumentId 
    });
    
    notePopup.remove();
  });
  
  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    padding: 6px 12px;
    background: #f3f4f6;
    color: #374151;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  `;
  cancelBtn.onmouseover = () => cancelBtn.style.background = '#e5e7eb';
  cancelBtn.onmouseout = () => cancelBtn.style.background = '#f3f4f6';
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notePopup.remove();
  });
  
  btnContainer.appendChild(cancelBtn);
  btnContainer.appendChild(confirmBtn);
  
  notePopup.appendChild(textarea);
  notePopup.appendChild(btnContainer);
  document.body.appendChild(notePopup);
  
  // Focus textarea
  textarea.focus();
  
  // Setup click handler to close on outside click
  const clickHandler = (e: MouseEvent) => {
    if (!notePopup.contains(e.target as Node)) {
      notePopup.remove();
      document.removeEventListener('click', clickHandler);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', clickHandler);
  }, 100);
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
