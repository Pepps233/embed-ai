/**
 * Highlight Manager - Range API Implementation
 * Phase 1.4 - Create, render, and persist highlights
 * Uses message passing to background script for all DB operations
 */

import type { HighlightAnchor } from '@shared/types';
import { NoteType, CreatedFrom } from '@shared/types';

export interface SerializedRange {
  startContainer: string; // XPath
  startOffset: number;
  endContainer: string; // XPath
  endOffset: number;
  commonAncestor: string; // XPath
}

interface ExtendedAnchor extends HighlightAnchor {
  range: SerializedRange;
  quoteText: string;
}

const HIGHLIGHT_CLASS = 'kc-highlight';
const HIGHLIGHT_ATTR = 'data-highlight-id';

/**
 * Create highlight from current selection
 */
export async function createHighlightFromSelection(
  documentId: string,
  color: string = '#FFFF0080'
): Promise<string | null> {
  console.log('[DEBUG] createHighlightFromSelection called, documentId:', documentId, 'color:', color);
  
  const selection = window.getSelection();
  console.log('[DEBUG] Selection:', selection, 'rangeCount:', selection?.rangeCount);
  
  if (!selection || selection.rangeCount === 0) {
    console.log('[DEBUG] No selection or no ranges, returning null');
    return null;
  }

  const range = selection.getRangeAt(0);
  console.log('[DEBUG] Range:', range, 'collapsed:', range.collapsed);
  
  if (range.collapsed) {
    console.log('[DEBUG] Range is collapsed, returning null');
    return null;
  }

  // Serialize the range
  console.log('[DEBUG] Serializing range...');
  const anchor = serializeRange(range);
  console.log('[DEBUG] Anchor:', anchor);
  
  if (!anchor) {
    console.log('[DEBUG] Failed to serialize range, returning null');
    return null;
  }

  // Create highlight in database via background script
  console.log('[DEBUG] Creating highlight in database via background...');
  const highlightId = await new Promise<string>((resolve) => {
    chrome.runtime.sendMessage({
      type: 'PERSIST_HIGHLIGHT',
      payload: {
        document_id: documentId,
        anchor,
        quote_text: anchor.quoteText,
        color,
      }
    }, (response) => {
      resolve(response.id);
    });
  });
  console.log('[DEBUG] Highlight created in DB, ID:', highlightId);

  // Render highlight in DOM
  console.log('[DEBUG] Rendering highlight in DOM...');
  renderHighlight(highlightId, range, color);
  console.log('[DEBUG] Highlight rendered');

  // Clear selection
  selection.removeAllRanges();
  console.log('[DEBUG] Selection cleared');

  // Notify side panel
  chrome.runtime.sendMessage({
    type: 'HIGHLIGHT_CREATED',
    documentId: documentId,
  });
  console.log('[DEBUG] Side panel notified');

  return highlightId;
}

/**
 * Serialize a Range to a stable anchor
 */
function serializeRange(range: Range): ExtendedAnchor | null {
  try {
    const quoteText = range.toString().trim();
    if (!quoteText) return null;

    // Get context for fuzzy matching
    const { prefix, suffix } = getContext(range);

    // Serialize range positions
    const serializedRange: SerializedRange = {
      startContainer: getXPath(range.startContainer),
      startOffset: range.startOffset,
      endContainer: getXPath(range.endContainer),
      endOffset: range.endOffset,
      commonAncestor: getXPath(range.commonAncestorContainer),
    };

    // Convert to shared HighlightAnchor format
    const startOffset = getTextOffset(range.startContainer, range.startOffset);
    const endOffset = getTextOffset(range.endContainer, range.endOffset);

    return {
      start_offset: startOffset,
      end_offset: endOffset,
      start_context: prefix,
      end_context: suffix,
      range: serializedRange,
      quoteText,
    };
  } catch (error) {
    console.error('Failed to serialize range:', error);
    return null;
  }
}

/**
 * Get character offset in document for a node position
 */
function getTextOffset(node: Node, offset: number): number {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentOffset = 0;
  let currentNode: Node | null;

  while ((currentNode = walker.nextNode())) {
    if (currentNode === node) {
      return currentOffset + offset;
    }
    currentOffset += (currentNode.textContent || '').length;
  }

  return currentOffset;
}

/**
 * Deserialize anchor back to Range
 */
export function deserializeRange(anchor: HighlightAnchor): Range | null {
  try {
    // Try using stored range if available (extended anchor)
    const extendedAnchor = anchor as any;
    if (extendedAnchor.range) {
      const serialized = extendedAnchor.range;
      const startNode = getNodeByXPath(serialized.startContainer);
      const endNode = getNodeByXPath(serialized.endContainer);

      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, serialized.startOffset);
        range.setEnd(endNode, serialized.endOffset);

        // Verify the text matches
        if (extendedAnchor.quoteText && range.toString().trim() === extendedAnchor.quoteText.trim()) {
          return range;
        }
      }
    }

    // Fallback: use offsets
    return findRangeAtOffset(anchor.start_offset, anchor.end_offset - anchor.start_offset);
  } catch (error) {
    console.error('Failed to deserialize range:', error);
    return findRangeAtOffset(anchor.start_offset, anchor.end_offset - anchor.start_offset);
  }
}


/**
 * Find Range at character offset in document
 */
function findRangeAtOffset(startOffset: number, length: number): Range | null {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentOffset = 0;
  let startNode: Node | null = null;
  let startNodeOffset = 0;
  let endNode: Node | null = null;
  let endNodeOffset = 0;

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent || '';
    const nodeLength = text.length;

    if (!startNode && currentOffset + nodeLength > startOffset) {
      startNode = node;
      startNodeOffset = startOffset - currentOffset;
    }

    if (currentOffset + nodeLength >= startOffset + length) {
      endNode = node;
      endNodeOffset = startOffset + length - currentOffset;
      break;
    }

    currentOffset += nodeLength;
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}

/**
 * Render highlight in DOM
 */
function renderHighlight(highlightId: string, range: Range, color: string): void {
  const span = document.createElement('span');
  span.className = HIGHLIGHT_CLASS;
  span.setAttribute(HIGHLIGHT_ATTR, highlightId);
  span.style.backgroundColor = color;
  span.style.cursor = 'pointer';

  try {
    range.surroundContents(span);
  } catch (error) {
    // If surroundContents fails (crosses element boundaries),
    // use extractContents and re-insert
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
  }

  // Add click handler
  span.addEventListener('click', (e) => {
    e.stopPropagation();
    handleHighlightClick(highlightId);
  });
}

/**
 * Restore all highlights for a document
 */
export async function restoreHighlights(documentId: string): Promise<void> {
  // Remove existing highlights
  removeAllHighlightElements();

  // Get highlights from database via background script
  const highlights = await new Promise<any[]>((resolve) => {
    chrome.runtime.sendMessage({
      type: 'GET_HIGHLIGHTS_BY_DOCUMENT',
      documentId
    }, (response) => {
      resolve(response.highlights || []);
    });
  });

  // Render each highlight
  for (const highlight of highlights) {
    const range = deserializeRange(highlight.anchor);
    if (range) {
      renderHighlight(highlight.id, range, highlight.color || '#FFFF00');
    }
  }
}

/**
 * Remove highlight from DOM
 */
export async function removeHighlight(highlightId: string): Promise<void> {
  const elements = document.querySelectorAll(`[${HIGHLIGHT_ATTR}="${highlightId}"]`);
  elements.forEach((el) => {
    const parent = el.parentNode;
    if (parent) {
      // Move children out of span
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
      // Normalize to merge adjacent text nodes
      parent.normalize();
    }
  });
}

/**
 * Remove all highlight elements from DOM
 */
function removeAllHighlightElements(): void {
  const elements = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  elements.forEach((el) => {
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  });
}

/**
 * Handle highlight click
 */
function handleHighlightClick(highlightId: string): void {
  // Show remove popup
  showRemovePopup(highlightId);
  
  // Send message to side panel to show highlight details
  chrome.runtime.sendMessage({
    type: 'HIGHLIGHT_CLICKED',
    highlightId,
  });
}

/**
 * Show note input UI for a highlight
 */
function showNoteInputForHighlight(highlightId: string, documentId: string, rect: DOMRect): void {
  // Remove any existing note input
  const existing = document.getElementById('kc-note-input');
  if (existing) existing.remove();
  
  const notePopup = document.createElement('div');
  notePopup.id = 'kc-note-input';
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
    if (!content) {
      notePopup.remove();
      return;
    }
    
    // Create note in DB via background script
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'PERSIST_NOTE',
        payload: {
          document_id: documentId,
          highlight_id: highlightId,
          content: content,
          metadata: {
            tags: [],
            type: NoteType.SUMMARY, 
            created_from: CreatedFrom.MANUAL
          }
        }
      }, resolve);
    });

    // Notify side panel to refresh
    chrome.runtime.sendMessage({ 
      type: 'NOTE_CREATED',
      documentId: documentId 
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
 * Show remove popup for highlighted text
 */
function showRemovePopup(highlightId: string): void {
  // Remove existing popup
  const existing = document.getElementById('kc-remove-popup');
  if (existing) existing.remove();
  
  const highlightElement = document.querySelector(`[data-highlight-id="${highlightId}"]`);
  if (!highlightElement) return;
  
  const rect = highlightElement.getBoundingClientRect();
  
  const popup = document.createElement('div');
  popup.id = 'kc-remove-popup';
  // Position the popup
  popup.style.cssText = `
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
  
  // --- CREATE NOTE BUTTON ---
  const noteBtn = document.createElement('button');
  noteBtn.textContent = 'Add Note';
  noteBtn.style.cssText = `
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
  noteBtn.onmouseover = () => noteBtn.style.background = '#f3f4f6';
  noteBtn.onmouseout = () => noteBtn.style.background = 'white';
  
  noteBtn.addEventListener('click', async () => {
    // Get the highlight to find the document_id via background script
    const highlights = await new Promise<any[]>((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_HIGHLIGHTS_BY_DOCUMENT',
        documentId: (window as any).__currentDocumentId || ''
      }, (response) => {
        resolve(response.highlights || []);
      });
    });
    
    const highlight = highlights.find(h => h.id === highlightId);
    if (!highlight) {
      console.error('Highlight not found');
      return;
    }

    // Remove the popup and show note input UI
    popup.remove();
    
    // Show custom note input UI at the highlight position
    showNoteInputForHighlight(highlightId, highlight.document_id, rect);
  });
  
  // --- REMOVE HIGHLIGHT BUTTON ---
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove Highlight';
  removeBtn.style.cssText = `
    display: block;
    width: 140px;
    padding: 10px 16px;
    background: white;
    color: #ef4444; /* Red color for delete action */
    border: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  `;
  removeBtn.onmouseover = () => removeBtn.style.background = '#fef2f2';
  removeBtn.onmouseout = () => removeBtn.style.background = 'white';
  removeBtn.addEventListener('click', async () => {
    // Delete highlight via background script
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ 
        type: 'DELETE_HIGHLIGHT', 
        highlightId 
      }, resolve);
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
    
    popup.remove();
  });
  
  popup.appendChild(noteBtn);
  popup.appendChild(removeBtn);
  document.body.appendChild(popup);
  
  // Close popup logic
  setTimeout(() => popup.remove(), 5000);
  const closeHandler = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node) && e.target !== highlightElement) {
      popup.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  // Use timeout to prevent immediate closing from the click that opened it
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/**
 * Get context around a range (for fuzzy matching)
 */
function getContext(range: Range): { prefix: string; suffix: string } {
  const CONTEXT_LENGTH = 50;

  const startContainer = range.startContainer;
  const endContainer = range.endContainer;

  // Get prefix
  let prefix = '';
  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent || '';
    const start = Math.max(0, range.startOffset - CONTEXT_LENGTH);
    prefix = text.substring(start, range.startOffset);
  }

  // Get suffix
  let suffix = '';
  if (endContainer.nodeType === Node.TEXT_NODE) {
    const text = endContainer.textContent || '';
    const end = Math.min(text.length, range.endOffset + CONTEXT_LENGTH);
    suffix = text.substring(range.endOffset, end);
  }

  return { prefix, suffix };
}

/**
 * Get XPath for a node
 */
function getXPath(node: Node): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
  }

  const parts: string[] = [];
  let current: Node | null = node;

  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const element = current as Element;
      let index = 1;
      let sibling: Element | null = element.previousElementSibling;

      while (sibling) {
        if (sibling.tagName === element.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      const tagName = element.tagName.toLowerCase();
      parts.unshift(`${tagName}[${index}]`);
    } else if (current.nodeType === Node.TEXT_NODE) {
      let index = 1;
      let sibling: Node | null = current.previousSibling;

      while (sibling) {
        if (sibling.nodeType === Node.TEXT_NODE) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      parts.unshift(`text()[${index}]`);
    }

    current = current.parentNode;
  }

  return '//' + parts.join('/');
}

/**
 * Get node by XPath
 */
function getNodeByXPath(xpath: string): Node | null {
  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  return result.singleNodeValue;
}
