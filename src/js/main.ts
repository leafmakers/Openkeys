import { resolveConfig } from '../core/config';
import { createEngine } from '../core/engine';
import { UI } from './ui';

function showFatalError(error: unknown) {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fee2e2;color:#991b1b;padding:20px;border-radius:8px;font-family:system-ui;text-align:center;z-index:9999;';
  const details = error instanceof Error ? error.message : String(error);
  el.innerHTML =
    `<h2>Failed to start OpenKeys</h2><p>Please refresh the page.</p>` +
    `<details style="margin-top:10px;text-align:left;font-size:12px;"><summary>Technical details</summary>` +
    `<pre style="white-space:pre-wrap;margin-top:5px;">${details}</pre></details>`;
  document.body.appendChild(el);
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    const config = resolveConfig({}, new URLSearchParams(window.location.search));
    const engine = createEngine(document.body, config);
    if (import.meta.env.DEV) (window as any).okEngine = engine; // dev-only debug handle
    new UI(engine, config); // UI builds the app chrome and drives the engine
    engine.start();

    window.addEventListener('pagehide', () => engine.destroy(), { once: true });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    showFatalError(error);
  }
});
