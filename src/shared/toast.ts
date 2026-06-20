/**
 * Lightweight, self-contained toast. Page chrome (not a feature module), so it
 * carries its own inline styles and depends on no stylesheet — any module can
 * call it without pulling in CSS.
 */
export function showToast(message: string, isError: boolean = true): void {
  const el = document.createElement('div');
  const palette = isError
    ? { bg: '#fee2e2', fg: '#991b1b', border: '#fecaca' }
    : { bg: '#d1fae5', fg: '#065f46', border: '#a7f3d0' };

  el.setAttribute('role', isError ? 'alert' : 'status');
  el.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${palette.bg};
    color: ${palette.fg};
    padding: 12px 20px;
    border-radius: 8px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    border: 1px solid ${palette.border};
    z-index: 2000;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    max-width: min(90vw, 480px);
    text-align: center;
    word-break: break-word;
  `;
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
