/**
 * Highlight Manager - Range API Implementation
 * Phase 1.4 - Create, render, and persist highlights
 */

import { highlightHelpers } from '../lib/db-helpers';
import type { Highlight, HighlightAnchor } from '@shared/types';

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
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return null;

  // Serialize the range
  const anchor = serializeRange(range);
  if (!anchor) return null;

  // Create highlight in database
  const highlightId = await highlightHelpers.create({
    document_id: documentId,
    anchor,
    quote_text: anchor.quoteText,
    color,
  });

  // Render highlight in DOM
  renderHighlight(highlightId, range, color);

  // Clear selection
  selection.removeAllRanges();

  // Notify side panel
  chrome.runtime.sendMessage({
    type: 'HIGHLIGHT_CREATED',
    documentId: documentId,
  });

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
    const bodyText = document.body.textContent || '';
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
 * Find range by text content (fuzzy matching fallback)
 */
function findRangeByText(anchor: HighlightAnchor, quoteText: string): Range | null {
  const { start_context, end_context } = anchor;
  const bodyText = document.body.textContent || '';

  // Search for quote with context
  const contextSearch = start_context + quoteText + end_context;
  let index = bodyText.indexOf(contextSearch);

  if (index === -1) {
    // Try without context
    index = bodyText.indexOf(quoteText);
    if (index === -1) return null;
  } else {
    index += start_context.length;
  }

  // Find the text node and offset
  return findRangeAtOffset(index, quoteText.length);
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

  // Get highlights from database
  const highlights = await highlightHelpers.getHighlightsByDocument(documentId);

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
 * Show remove popup for highlighted text
 */
function showRemovePopup(highlightId: string): void {
  // Remove existing popup
  const existing = document.getElementById('kc-remove-popup');
  if (existing) existing.remove();
  
  const highlightElement = document.querySelector(`[${HIGHLIGHT_ATTR}="${highlightId}"]`);
  if (!highlightElement) return;
  
  const rect = highlightElement.getBoundingClientRect();
  
  const popup = document.createElement('div');
  popup.id = 'kc-remove-popup';
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
  
  // Create Note button
  const noteBtn = document.createElement('button');
  noteBtn.textContent = 'Create Note';
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
    popup.remove();
    // Open side panel to notes tab
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  });
  
  // Remove Highlight button
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove Highlight';
  removeBtn.style.cssText = `
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
  removeBtn.onmouseover = () => removeBtn.style.background = '#f3f4f6';
  removeBtn.onmouseout = () => removeBtn.style.background = 'white';
  removeBtn.addEventListener('click', async () => {
    await highlightHelpers.delete(highlightId);
    await removeHighlight(highlightId);
    popup.remove();
  });
  
  popup.appendChild(noteBtn);
  popup.appendChild(removeBtn);
  document.body.appendChild(popup);
  
  // Remove popup after 5 seconds or on click outside
  setTimeout(() => popup.remove(), 5000);
  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target as Node) && e.target !== highlightElement) {
      popup.remove();
    }
  }, { once: true });
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
