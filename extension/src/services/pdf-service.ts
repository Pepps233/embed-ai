/**
 * PDF Service - pdf.js wrapper for rendering and text extraction
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
  charStart: number;
  charEnd: number;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  pageCount: number;
  fileSize?: number;
}

export interface TextLayerItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

/**
 * Load a PDF document from URL or ArrayBuffer
 */
export async function loadPDF(source: string | ArrayBuffer): Promise<PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument(source);
  return loadingTask.promise;
}

/**
 * Extract text from a single PDF page
 */
export async function extractPageText(page: PDFPageProxy): Promise<string> {
  const textContent = await page.getTextContent();
  const textItems = textContent.items as TextItem[];

  // Join text items, preserving some structure
  let lastY: number | null = null;
  const lines: string[] = [];
  let currentLine: string[] = [];

  for (const item of textItems) {
    if (!item.str) continue;

    const y = item.transform[5];

    // New line if Y position changed significantly
    if (lastY !== null && Math.abs(y - lastY) > 5) {
      if (currentLine.length > 0) {
        lines.push(currentLine.join(' '));
        currentLine = [];
      }
    }

    currentLine.push(item.str);
    lastY = y;
  }

  // Don't forget the last line
  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '));
  }

  return lines.join('\n');
}

/**
 * Extract text from all pages of a PDF
 */
export async function extractAllPagesText(
  pdf: PDFDocumentProxy,
  onProgress?: (page: number, total: number) => void
): Promise<ExtractedPageText[]> {
  const pages: ExtractedPageText[] = [];
  let currentOffset = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await extractPageText(page);

    const charStart = currentOffset;
    const charEnd = currentOffset + text.length;

    pages.push({
      pageNumber: i,
      text,
      charStart,
      charEnd,
    });

    currentOffset = charEnd + 1; // +1 for page separator

    if (onProgress) {
      onProgress(i, pdf.numPages);
    }
  }

  return pages;
}

/**
 * Get PDF metadata
 */
export async function getPDFMetadata(pdf: PDFDocumentProxy): Promise<PDFMetadata> {
  const metadata = await pdf.getMetadata();
  const info = metadata.info as any;

  return {
    title: info?.Title || undefined,
    author: info?.Author || undefined,
    pageCount: pdf.numPages,
  };
}

/**
 * Render a PDF page to a canvas
 */
export async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ width: number; height: number }> {
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d')!;

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  return {
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Get text content with positions for text layer rendering
 */
export async function getTextContentWithPositions(
  page: PDFPageProxy,
  scale: number = 1.5
): Promise<{ items: TextLayerItem[]; viewport: any }> {
  const viewport = page.getViewport({ scale });
  const textContent = await page.getTextContent();

  const items: TextLayerItem[] = (textContent.items as TextItem[]).map((item) => ({
    str: item.str,
    transform: item.transform,
    width: item.width,
    height: item.height,
    fontName: item.fontName,
  }));

  return { items, viewport };
}

/**
 * Check if URL points to a PDF
 */
export function isPDFUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    // Check file extension
    if (pathname.endsWith('.pdf')) {
      return true;
    }

    // Check common PDF hosting patterns
    if (urlObj.searchParams.get('format') === 'pdf') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get filename from PDF URL
 */
export function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'document.pdf';
    return decodeURIComponent(filename);
  } catch {
    return 'document.pdf';
  }
}
