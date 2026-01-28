/**
 * DOM Text Extraction Service
 * Phase 1.3 - Extract visible text from web pages
 */

export interface ExtractedText {
  text: string;
  charStart: number;
  charEnd: number;
  xpath?: string;
  element?: HTMLElement;
}

export interface ExtractionOptions {
  includeHidden?: boolean;
  maxLength?: number;
  excludeSelectors?: string[];
}

/**
 * Extract visible text from the current page
 */
export function extractPageText(options: ExtractionOptions = {}): ExtractedText[] {
  const {
    includeHidden = false,
    maxLength = 1000000,
    excludeSelectors = ['script', 'style', 'noscript', 'iframe', 'svg'],
  } = options;

  const results: ExtractedText[] = [];
  let currentOffset = 0;

  // Get main content area (prioritize article, main, or body)
  const contentRoot =
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.body;

  if (!contentRoot) return results;

  // Walk through text nodes
  const walker = document.createTreeWalker(
    contentRoot,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip excluded elements
        const tagName = parent.tagName.toLowerCase();
        if (excludeSelectors.includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip hidden elements
        if (!includeHidden) {
          const style = window.getComputedStyle(parent);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          ) {
            return NodeFilter.FILTER_REJECT;
          }
        }

        // Skip empty text
        const text = node.textContent?.trim();
        if (!text) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node: Node | null;
  while ((node = walker.nextNode()) && currentOffset < maxLength) {
    const text = node.textContent?.trim();
    if (!text) continue;

    const charStart = currentOffset;
    const charEnd = currentOffset + text.length;

    results.push({
      text,
      charStart,
      charEnd,
      xpath: getXPath(node.parentElement!),
      element: node.parentElement!,
    });

    currentOffset = charEnd + 1; // +1 for space between nodes
  }

  return results;
}

/**
 * Extract text from a specific element
 */
export function extractElementText(element: HTMLElement): string {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const texts: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (text) texts.push(text);
  }

  return texts.join(' ');
}

/**
 * Get XPath for an element (for stable anchoring)
 */
export function getXPath(element: HTMLElement): string {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const parts: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 0;
    let sibling: Element | null = current;

    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    const tagName = current.tagName.toLowerCase();
    const part = index > 1 ? `${tagName}[${index}]` : tagName;
    parts.unshift(part);

    current = current.parentElement;
  }

  return '/' + parts.join('/');
}

/**
 * Find element by XPath
 */
export function getElementByXPath(xpath: string): HTMLElement | null {
  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  return result.singleNodeValue as HTMLElement | null;
}

/**
 * Get visible text in viewport
 */
export function getVisibleText(): ExtractedText[] {
  const allText = extractPageText();
  
  return allText.filter((item) => {
    if (!item.element) return false;
    
    const rect = item.element.getBoundingClientRect();
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  });
}

/**
 * Extract metadata from page
 */
export interface PageMetadata {
  title: string;
  author?: string;
  description?: string;
  url: string;
  domain: string;
  publishedDate?: string;
}

export function extractPageMetadata(): PageMetadata {
  const getMetaContent = (name: string): string | undefined => {
    const meta =
      document.querySelector(`meta[name="${name}"]`) ||
      document.querySelector(`meta[property="${name}"]`) ||
      document.querySelector(`meta[property="og:${name}"]`);
    return meta?.getAttribute('content') || undefined;
  };

  return {
    title: document.title,
    author: getMetaContent('author'),
    description: getMetaContent('description'),
    url: window.location.href,
    domain: window.location.hostname,
    publishedDate: getMetaContent('article:published_time'),
  };
}
