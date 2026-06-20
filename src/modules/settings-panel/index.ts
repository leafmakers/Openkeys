/**
 * settings-panel — the gear-button slide-over: keyboard layout, theme, intro
 * animation, poster-button visibility, and a "copy shareable link" action that
 * encodes the current state into a URL.
 *
 * Structural changes (layout, intro) reload the page with the text preserved in
 * the URL; live changes (theme, poster visibility) go straight through the engine.
 * The shadow-angle slider in the bottom controls is wired here too (it drives the
 * key light) — it's slated for removal in the UX pass.
 */
import type { OpenKeysModule } from '../../core/types';
import { showToast } from '../../shared/toast';
import './style.css';

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return (
    host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) ||
    host.querySelector<HTMLElement>(`#${id}`)
  );
}

export const settingsPanel: OpenKeysModule = ({ engine, host, signal }) => {
  // Shadow-angle slider lives in the bottom #controls cluster, independent of the panel.
  const shadowAngle = resolve(host, 'shadow-angle', 'shadowAngle') as HTMLInputElement | null;
  shadowAngle?.addEventListener(
    'input',
    (e) => engine.setLightAngle(parseInt((e.target as HTMLInputElement).value, 10)),
    { signal }
  );

  const toggle = resolve(host, 'settings-toggle', 'settingsToggle');
  if (!engine.config.features.settingsPanel) {
    toggle?.classList.add('hidden');
    return () => {}; // shadow-angle listener is removed via the shared AbortSignal
  }

  let panel: HTMLElement | null = null;
  const offs: Array<() => void> = [];

  /** Build a shareable URL that reproduces the current configuration. */
  const buildShareUrl = (overrides: Record<string, string> = {}): string => {
    const params = new URLSearchParams();
    const { config } = engine;
    if (engine.currentText) params.set('text', engine.currentText);
    if (config.layout.preset && config.layout.preset !== 'qwerty') {
      params.set('layout', config.layout.preset);
    }
    params.set('theme', engine.themeMode);
    if (!config.animation.intro.enabled) params.set('intro', '0');
    if (!config.features.poster) params.set('poster', '0');
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '' || v == null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return `${location.origin}${location.pathname}${qs ? '?' + qs : ''}`;
  };

  const syncThemeSegment = () => {
    panel?.querySelectorAll<HTMLElement>('#settingsTheme button').forEach((el) => {
      el.classList.toggle('active', el.dataset.theme === engine.themeMode);
    });
  };

  const reflectConfig = () => {
    if (!panel) return;
    const { config } = engine;
    const layoutSel = panel.querySelector<HTMLSelectElement>('#settingsLayout');
    if (layoutSel) layoutSel.value = config.layout.preset || 'qwerty';
    const introChk = panel.querySelector<HTMLInputElement>('#settingsIntro');
    if (introChk) introChk.checked = config.animation.intro.enabled;
    const posterChk = panel.querySelector<HTMLInputElement>('#settingsPoster');
    if (posterChk) posterChk.checked = config.features.poster;
  };

  const build = () => {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.className = 'settings-panel';
    panel.innerHTML = `
      <div class="settings-header">
        <span>Settings</span>
        <button id="settingsClose" class="settings-close" aria-label="Close settings">×</button>
      </div>
      <label class="settings-field">
        <span>Keyboard layout</span>
        <select id="settingsLayout">
          <option value="qwerty">QWERTY</option>
          <option value="azerty">AZERTY</option>
          <option value="dvorak">Dvorak</option>
          <option value="numpad">Numpad</option>
        </select>
      </label>
      <div class="settings-field">
        <span>Theme</span>
        <div class="settings-segment" id="settingsTheme">
          <button data-theme="light">Light</button>
          <button data-theme="dark">Dark</button>
        </div>
      </div>
      <label class="settings-check">
        <input type="checkbox" id="settingsIntro" />
        <span>Intro spin animation</span>
      </label>
      <label class="settings-check">
        <input type="checkbox" id="settingsPoster" />
        <span>Show "Preview Poster" button</span>
      </label>
      <button id="settingsShare" class="settings-share">Copy shareable link</button>
      <p class="settings-hint">Layout changes reload the page with your text preserved.</p>
    `;
    host.appendChild(panel);

    reflectConfig();
    syncThemeSegment();

    const layoutSel = panel.querySelector('#settingsLayout') as HTMLSelectElement;
    layoutSel.addEventListener(
      'change',
      () => location.assign(buildShareUrl({ layout: layoutSel.value === 'qwerty' ? '' : layoutSel.value })),
      { signal }
    );

    panel.querySelector('#settingsClose')?.addEventListener('click', () => close(), { signal });

    panel.querySelector('#settingsTheme')?.addEventListener(
      'click',
      (e) => {
        const btn = (e.target as HTMLElement).closest('button[data-theme]') as HTMLElement | null;
        if (!btn) return;
        const wantDark = btn.dataset.theme === 'dark';
        if (wantDark !== (engine.themeMode === 'dark')) {
          engine.setTheme(wantDark ? 'dark' : 'light');
        }
      },
      { signal }
    );

    const introChk = panel.querySelector('#settingsIntro') as HTMLInputElement;
    introChk.addEventListener(
      'change',
      () => location.assign(buildShareUrl({ intro: introChk.checked ? '' : '0' })),
      { signal }
    );

    const posterChk = panel.querySelector('#settingsPoster') as HTMLInputElement;
    posterChk.addEventListener(
      'change',
      () => engine.setConfig({ features: { poster: posterChk.checked } }),
      { signal }
    );

    const shareBtn = panel.querySelector('#settingsShare') as HTMLButtonElement;
    shareBtn.addEventListener(
      'click',
      async () => {
        const url = buildShareUrl();
        try {
          await navigator.clipboard.writeText(url);
          shareBtn.textContent = 'Copied!';
          setTimeout(() => (shareBtn.textContent = 'Copy shareable link'), 1500);
        } catch {
          showToast(url, false);
        }
      },
      { signal }
    );
  };

  const isOpen = () => panel?.classList.contains('open') ?? false;
  const open = () => {
    build();
    panel?.classList.add('open');
  };
  const close = () => panel?.classList.remove('open');
  const toggleOpen = () => (isOpen() ? close() : open());

  toggle?.addEventListener('click', toggleOpen, { signal });

  // Reflect live engine state into the panel controls.
  offs.push(engine.on('theme', syncThemeSegment));
  offs.push(engine.on('config', reflectConfig));

  return () => {
    offs.forEach((off) => off());
    panel?.remove();
    panel = null;
  };
};
