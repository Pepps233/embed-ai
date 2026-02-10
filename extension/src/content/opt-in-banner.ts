/**
 * Opt-in Banner Module
 * Shows a prompt asking the user to activate Embed AI on the current page.
 * Shared by both content-script.ts and pdf-detector.ts.
 */

export interface OptInBannerOptions {
  subtitle: string;
  description: string;
  acceptLabel: string;
}

/**
 * Shows an opt-in banner and resolves true if the user accepts, false otherwise.
 * Auto-dismisses after 15 seconds (resolves false).
 * Guards against duplicate banners via element ID check.
 */
export function showOptInBanner(options: OptInBannerOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const BANNER_ID = 'embed-ai-opt-in-banner';

    // Guard against duplicate banners
    if (document.getElementById(BANNER_ID)) {
      resolve(false);
      return;
    }

    let resolved = false;
    function finish(accepted: boolean) {
      if (resolved) return;
      resolved = true;
      clearTimeout(autoDismissTimer);
      if (banner.parentNode) {
        banner.style.animation = 'embedAiSlideIn 0.2s ease-out reverse';
        setTimeout(() => banner.remove(), 200);
      }
      resolve(accepted);
    }

    // Animation keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes embedAiSlideIn {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      #${BANNER_ID} button { transition: all 0.15s ease; }
      #${BANNER_ID} button:hover { transform: translateY(-1px); }
    `;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
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
      animation: embedAiSlideIn 0.3s ease-out;
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
    closeBtn.onclick = () => finish(false);

    // Header with icon
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; gap: 10px;';

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
      <div style="font-size: 12px; color: #9ca3af;">${options.subtitle}</div>
    `;

    header.appendChild(icon);
    header.appendChild(title);

    // Description
    const message = document.createElement('p');
    message.textContent = options.description;
    message.style.cssText = `
      font-size: 13px;
      color: #d1d5db;
      margin: 0;
      line-height: 1.4;
    `;

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px;';

    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = options.acceptLabel;
    acceptBtn.style.cssText = `
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
    acceptBtn.onclick = () => finish(true);

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
    dismissBtn.onclick = () => finish(false);

    buttonContainer.appendChild(acceptBtn);
    buttonContainer.appendChild(dismissBtn);

    banner.appendChild(closeBtn);
    banner.appendChild(header);
    banner.appendChild(message);
    banner.appendChild(buttonContainer);

    document.body.appendChild(banner);

    // Auto-dismiss after 15 seconds
    const autoDismissTimer = setTimeout(() => finish(false), 15000);
  });
}
