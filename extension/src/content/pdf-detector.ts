/**
 * PDF Detector Content Script
 * Detects browser's built-in PDF viewer and offers to open in Embed AI
 */

console.log('Embed AI PDF detector loaded');

// Check if we're viewing a PDF in Chrome's viewer
function isPDFPage(): boolean {
  // Check URL
  const url = window.location.href;
  if (url.toLowerCase().endsWith('.pdf')) {
    return true;
  }

  // Check content type via embed element (Chrome PDF viewer)
  const embed = document.querySelector('embed[type="application/pdf"]');
  if (embed) {
    return true;
  }

  // Check for Chrome's PDF viewer structure
  const pdfViewer = document.querySelector('#viewer');
  if (pdfViewer && document.contentType === 'application/pdf') {
    return true;
  }

  // Check document MIME type
  if (document.contentType === 'application/pdf') {
    return true;
  }

  return false;
}

// Show the "Open in Embed AI" banner
function showOpenInEmbedAIBanner() {
  // Don't show if already shown
  if (document.getElementById('embed-ai-pdf-banner')) {
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'embed-ai-pdf-banner';
  banner.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 2147483647;
    background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 320px;
    animation: slideIn 0.3s ease-out;
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    #embed-ai-pdf-banner button {
      transition: all 0.15s ease;
    }
    #embed-ai-pdf-banner button:hover {
      transform: translateY(-1px);
    }
  `;
  document.head.appendChild(style);

  // Header with logo placeholder
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  const icon = document.createElement('div');
  icon.style.cssText = `
    width: 32px;
    height: 32px;
    background: #3b82f6;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
  `;
  icon.textContent = 'AI';

  const title = document.createElement('div');
  title.innerHTML = `
    <div style="font-weight: 600; font-size: 15px;">Embed AI</div>
    <div style="font-size: 12px; color: #9ca3af;">PDF Detected</div>
  `;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  `;
  closeBtn.onclick = () => banner.remove();

  header.appendChild(icon);
  header.appendChild(title);

  // Message
  const message = document.createElement('p');
  message.textContent = 'Open this PDF in Embed AI to highlight text, take notes, and ask questions.';
  message.style.cssText = `
    font-size: 13px;
    color: #d1d5db;
    margin: 0;
    line-height: 1.4;
  `;

  // Buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 8px;
  `;

  const openBtn = document.createElement('button');
  openBtn.textContent = 'Open in Embed AI';
  openBtn.style.cssText = `
    flex: 1;
    padding: 10px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  `;
  openBtn.onclick = () => {
    openInEmbedAI();
    banner.remove();
  };

  const dismissBtn = document.createElement('button');
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.style.cssText = `
    padding: 10px 16px;
    background: #374151;
    color: #d1d5db;
    border: 1px solid #4b5563;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  `;
  dismissBtn.onclick = () => banner.remove();

  buttonContainer.appendChild(openBtn);
  buttonContainer.appendChild(dismissBtn);

  banner.appendChild(closeBtn);
  banner.appendChild(header);
  banner.appendChild(message);
  banner.appendChild(buttonContainer);

  document.body.appendChild(banner);

  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    if (banner.parentNode) {
      banner.style.animation = 'slideIn 0.2s ease-out reverse';
      setTimeout(() => banner.remove(), 200);
    }
  }, 15000);
}

// Open the PDF in Embed AI viewer
function openInEmbedAI() {
  const pdfUrl = window.location.href;
  const viewerUrl = chrome.runtime.getURL('src/pdf-viewer/index.html');
  const fullUrl = `${viewerUrl}?url=${encodeURIComponent(pdfUrl)}`;

  // Open in new tab
  window.open(fullUrl, '_blank');
}

// Initialize
function init() {
  // Wait a bit for the page to fully load
  setTimeout(() => {
    if (isPDFPage()) {
      console.log('Embed AI: PDF detected, showing banner');
      showOpenInEmbedAIBanner();
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
    openInEmbedAI();
    sendResponse({ success: true });
    return true;
  }
});
