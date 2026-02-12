/**
 * Shared PDF utilities used by both pdf-detector.ts and content-script.ts
 */

/**
 * Check if the current page is displaying a PDF
 */
export function isPDFPage(): boolean {
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

/**
 * Inject an inline iframe that loads the Embed AI PDF viewer in the current tab.
 */
export function injectInlinePDFViewer() {
  const pdfUrl = window.location.href;
  const viewerUrl = chrome.runtime.getURL('src/pdf-viewer/index.html');
  const fullUrl = `${viewerUrl}?url=${encodeURIComponent(pdfUrl)}`;

  // Clear the current page content
  document.documentElement.innerHTML = '';

  // Rebuild minimal head
  const head = document.createElement('head');
  const meta = document.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  head.appendChild(meta);

  const titleEl = document.createElement('title');
  titleEl.textContent = 'Embed AI – PDF Viewer';
  head.appendChild(titleEl);

  const style = document.createElement('style');
  style.textContent = `
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  `;
  head.appendChild(style);

  // Rebuild body with full-page iframe
  const body = document.createElement('body');
  const iframe = document.createElement('iframe');
  iframe.src = fullUrl;
  iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
  iframe.setAttribute('allow', 'fullscreen');
  body.appendChild(iframe);

  document.documentElement.appendChild(head);
  document.documentElement.appendChild(body);

  // Focus the iframe after a short delay to ensure it's loaded
  setTimeout(() => {
    iframe.contentWindow?.focus();
  }, 500);
}
