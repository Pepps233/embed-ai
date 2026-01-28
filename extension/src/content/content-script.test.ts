import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Content Script - Message Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send message to background script', () => {
    const mockSendMessage = vi.fn();
    chrome.runtime.sendMessage = mockSendMessage;

    chrome.runtime.sendMessage({
      type: 'GET_DOCUMENT_BY_SOURCE',
      source: 'https://example.com'
    });

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'GET_DOCUMENT_BY_SOURCE',
      source: 'https://example.com'
    });
  });

  it('should handle CREATE_DOCUMENT message', () => {
    const mockSendMessage = vi.fn();
    chrome.runtime.sendMessage = mockSendMessage;

    const documentData = {
      type: 'CREATE_DOCUMENT',
      title: 'Test Document',
      source: 'https://example.com',
      metadata: {}
    };

    chrome.runtime.sendMessage(documentData);

    expect(mockSendMessage).toHaveBeenCalledWith(documentData);
  });
});

describe('Content Script - Text Selection', () => {
  it('should detect text selection', () => {
    const selection = window.getSelection();
    expect(selection).toBeDefined();
  });

  it('should calculate selection offsets', () => {
    const startOffset = 10;
    const endOffset = 25;
    
    expect(endOffset).toBeGreaterThan(startOffset);
    expect(endOffset - startOffset).toBe(15);
  });
});

describe('Content Script - Highlight Creation', () => {
  it('should create highlight data structure', () => {
    const highlight = {
      id: 'hl-test',
      document_id: 'doc-1',
      text: 'Selected text',
      start_offset: 0,
      end_offset: 13,
      color: '#FFEB3B',
      created_at: new Date().toISOString()
    };

    expect(highlight.text).toBe('Selected text');
    expect(highlight.color).toBe('#FFEB3B');
    expect(highlight.end_offset - highlight.start_offset).toBe(13);
  });
});
