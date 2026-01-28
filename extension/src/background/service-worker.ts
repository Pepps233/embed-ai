/**
 * Background Service Worker - Phase 1
 * Handles extension lifecycle and message passing
 * Centralizes all database operations to fix content script/side panel isolation
 */

import { highlightHelpers, noteHelpers, documentHelpers, pageTextHelpers } from '../lib/db-helpers';

console.log('Embed AI background service worker loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Embed AI installed');
});

// Track side panel state per tab
const sidePanelState: Map<number, boolean> = new Map();

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  // Database Operations - All DB writes go through here
  if (message.type === 'CREATE_DOCUMENT') {
    (async () => {
      try {
        const { type, source, title, author, status, metadata } = message.payload;
        const docId = await documentHelpers.create({
          type,
          source,
          title,
          author,
          status,
          metadata,
        });
        sendResponse({ documentId: docId });
      } catch (error) {
        console.error('Error creating document:', error);
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }
  
  if (message.type === 'GET_DOCUMENT_BY_SOURCE') {
    (async () => {
      try {
        const doc = await documentHelpers.getBySource(message.source);
        sendResponse({ document: doc });
      } catch (error) {
        console.error('Error getting document:', error);
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }
  
  if (message.type === 'CREATE_PAGE_TEXT') {
    (async () => {
      try {
        const id = await pageTextHelpers.create(message.payload);
        sendResponse({ id });
      } catch (error) {
        console.error('Error creating page text:', error);
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }
  
  if (message.type === 'PERSIST_HIGHLIGHT') {
    (async () => {
      try {
        const id = await highlightHelpers.create(message.payload);
        sendResponse({ id });
      } catch (error) {
        console.error('Error persisting highlight:', error);
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }
  
  if (message.type === 'GET_HIGHLIGHTS_BY_DOCUMENT') {
    (async () => {
      try {
        const highlights = await highlightHelpers.getHighlightsByDocument(message.documentId);
        sendResponse({ highlights });
      } catch (error) {
        console.error('Error getting highlights:', error);
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'PERSIST_NOTE') {
    (async () => {
      try {
        const id = await noteHelpers.create(message.payload);
        sendResponse({ id });
      } catch (error) {
        console.error('Error persisting note:', error);
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }
  
  if (message.type === 'DELETE_HIGHLIGHT') {
    (async () => {
      try {
        await highlightHelpers.delete(message.highlightId);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error deleting highlight:', error);
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }

  if (message.type === 'DELETE_NOTE') {
    (async () => {
      try {
        await noteHelpers.delete(message.noteId);
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error deleting note:', error);
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }
  
  // Side Panel Operations
  if (message.type === 'OPEN_SIDE_PANEL') {
    if (sender.tab?.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
      sidePanelState.set(sender.tab.id, true);
    }
    sendResponse({ received: true });
    return true;
  }
  
  if (message.type === 'TOGGLE_SIDE_PANEL') {
    if (sender.tab?.id) {
      const isOpen = sidePanelState.get(sender.tab.id);
      if (isOpen) {
        sidePanelState.set(sender.tab.id, false);
        sendResponse({ action: 'close' });
      } else {
        chrome.sidePanel.open({ tabId: sender.tab.id });
        sidePanelState.set(sender.tab.id, true);
        sendResponse({ action: 'open' });
      }
    }
    return true;
  }
  
  // Pass through messages (for notifications between components)
  sendResponse({ received: true });
  return true;
});
