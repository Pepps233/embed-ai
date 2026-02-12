/**
 * PDF Detector Content Script
 * Detects browser's built-in PDF viewer and offers inline viewing in Embed AI
 */

import { showOptInBanner } from './opt-in-banner';
import { isPDFPage, injectInlinePDFViewer } from './pdf-utils';

console.log('Embed AI PDF detector loaded');

// Initialize
function init() {
  // Wait a bit for the page to fully load
  setTimeout(async () => {
    if (isPDFPage()) {
      console.log('Embed AI: PDF detected, showing opt-in banner');

      const accepted = await showOptInBanner({
        subtitle: 'PDF Detected',
        description: 'Open this PDF in Embed AI to highlight text, take notes, and ask questions.',
        acceptLabel: 'Open in Embed AI',
      });

      if (accepted) {
        injectInlinePDFViewer();
      }
    }
  }, 500);
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK_PDF') {
    sendResponse({ isPDF: isPDFPage() });
    return true;
  }

  if (message.type === 'OPEN_PDF_IN_VIEWER') {
    injectInlinePDFViewer();
    sendResponse({ success: true });
    return true;
  }
});
