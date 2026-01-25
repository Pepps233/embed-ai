/**
 * Background Service Worker - Phase 1
 * Handles extension lifecycle and message passing
 */

console.log('Knowledge Companion background service worker loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Knowledge Companion installed');
});

// Track side panel state per tab
const sidePanelState: Map<number, boolean> = new Map();

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.type === 'OPEN_SIDE_PANEL') {
    if (sender.tab?.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
      sidePanelState.set(sender.tab.id, true);
    }
  } else if (message.type === 'TOGGLE_SIDE_PANEL') {
    if (sender.tab?.id) {
      const isOpen = sidePanelState.get(sender.tab.id);
      if (isOpen) {
        // Close side panel by opening a different view (Chrome doesn't have direct close API)
        // Best we can do is notify the user or just toggle the state
        sidePanelState.set(sender.tab.id, false);
        sendResponse({ action: 'close' });
      } else {
        chrome.sidePanel.open({ tabId: sender.tab.id });
        sidePanelState.set(sender.tab.id, true);
        sendResponse({ action: 'open' });
      }
    }
  }
  
  sendResponse({ received: true });
  return true;
});
