import { resolveConfig } from '../core/config';
import { createEngine } from '../core/engine';
import { composeModules } from '../core/compose';
import { textInput } from '../modules/text-input';
import { characterBar } from '../modules/character-bar';
import { typingSpeed } from '../modules/typing-speed';
import { themeToggle } from '../modules/theme-toggle';
import { poster } from '../modules/poster';
import { settingsPanel } from '../modules/settings-panel';
import { fontLibrary } from '../modules/font-library';

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

    // Page-chrome theme (single-instance): mirror engine theme to <body>/<html> + persist.
    engine.on('theme', ({ mode, colors }) => {
      document.body.style.background = colors.background;
      document.documentElement.setAttribute('data-theme', mode);
      localStorage.setItem('theme', mode);
    });
    // Seed theme: explicit ?theme= wins, else saved preference, else config default.
    const urlHasTheme = new URLSearchParams(window.location.search).has('theme');
    const saved = localStorage.getItem('theme');
    const initialMode = urlHasTheme
      ? config.theme.mode
      : saved === 'light' || saved === 'dark'
        ? saved
        : config.theme.mode;
    engine.setTheme(initialMode);

    // Feature modules. `textInput`/`characterBar`/`typingSpeed` are gated at compose time;
    // the rest always compose and gate themselves internally on their config flag (they own
    // static chrome that must be hidden — or, for poster/settings, toggled live — when off).
    const modules = [
      config.features.textInput && textInput,
      config.features.characterBar && characterBar,
      config.features.typingSpeed && typingSpeed,
      themeToggle,
      fontLibrary,
      poster,
      settingsPanel,
    ].filter(Boolean) as import('../core/types').OpenKeysModule[];
    const teardownModules = composeModules(engine, document.body, modules);

    // Apply initial text (config.text / ?text=) once the keyboard mesh is built.
    engine.on('ready', () => {
      if (config.text) engine.setText(config.text);
    });
    engine.start();

    window.addEventListener('pagehide', () => {
      teardownModules();
      engine.destroy();
    }, { once: true });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    showFatalError(error);
  }
});
