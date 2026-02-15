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
