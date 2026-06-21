import { resolveConfig, layoutPreset } from '../core/config';
import { createEngine } from '../core/engine';
import { composeModules } from '../core/compose';
import { textInput } from '../modules/text-input';
import { characterBar } from '../modules/character-bar';
import { typingSpeed } from '../modules/typing-speed';
import { themeToggle } from '../modules/theme-toggle';
import { poster } from '../modules/poster';
import { settingsPanel } from '../modules/settings-panel';
import { fontLibrary } from '../modules/font-library';
import { sound } from '../modules/sound';
import { samplePhrase } from '../modules/sample-phrase';
import { viewCube } from '../modules/view-cube';
import { viewToggles } from '../modules/view-toggles';
import { createEffects, effectsPanel, selectiveBloom, godRays } from '../modules/effects';

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
    const params = new URLSearchParams(window.location.search);
    // The app opens on the full Mac board by default; an explicit ?layout= still wins
    // (the library/embed keeps the neutral QWERTY default from defaultConfig).
    const appDefaults = params.has('layout') ? {} : layoutPreset('full');
    const config = resolveConfig(appDefaults, params);
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
      viewToggles, // navbar quick toggles: auto-rotate, turntable orbit, projection
      viewCube, // navbar gumball: hollow dot-cube mirroring + driving the camera orbit
      fontLibrary,
      poster,
      settingsPanel,
      sound, // gates playback live on config.features.sound (toggleable in settings)
      samplePhrase, // navbar fox button → types a pangram
    ].filter(Boolean) as import('../core/types').OpenKeysModule[];

    // Environment-FX experiment harness — opt-in via ?fx. The pipeline module owns
    // the EffectComposer; the panel (dev-only) drives it. Order matters: the pipeline
    // must compose before the panel so the controller is live when the panel reads it.
    if (new URLSearchParams(window.location.search).has('fx')) {
      const fx = createEffects([selectiveBloom, godRays]);
      modules.push(fx.module, effectsPanel(fx.controller));
      if (import.meta.env.DEV) (window as any).okFx = fx.controller; // console tinkering

    }

    const teardownModules = composeModules(engine, document.body, modules);

    // Initial content. An explicit ?text= / config.text wins; otherwise play the
    // branded opening once, after the mesh is built: animate the product name into
    // a skyline, hold so the visitor sees what the tool does, then clear back to
    // the resting board they start from. Reuses the engine's animated typeText/clear.
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    let openingPlayed = false;
    engine.on('ready', ({ reason }) => {
      if (reason !== 'init' || openingPlayed) return;
      openingPlayed = true;
      if (config.text) {
        engine.setText(config.text);
        return;
      }
      void (async () => {
        try {
          await engine.typeText('openkey');
          await wait(2000);
          await engine.clear();
        } catch {
          /* opening is non-critical — ignore animation/interruption errors */
        }
      })();
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
