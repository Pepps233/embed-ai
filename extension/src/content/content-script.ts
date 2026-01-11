console.log('Knowledge Companion content script loaded');

let isInitialized = false;

function initialize() {
  if (isInitialized) return;
  
  console.log('Initializing content script for:', window.location.href);
  
  isInitialized = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.type === 'EXTRACT_TEXT') {
    const text = document.body.innerText;
    sendResponse({ text });
  }
  
  return true;
});
