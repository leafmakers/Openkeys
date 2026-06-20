/**
 * OpenKeys — embeddable library entry point.
 *
 * Ships the pure engine (config + scene + keyboard + loop + typed events), a
 * `createOpenKeys()` factory, the `<open-keys>` web component, and (added as
 * modules are extracted) à-la-carte feature modules. Embedders compose exactly
 * what they want:
 *
 *   import { createOpenKeys, DVORAK_ROWS } from 'openkeys';
 *   const kb = createOpenKeys(el, { text: 'hello', layout: { rows: DVORAK_ROWS, preset: 'dvorak' } });
 *   kb.setText('world');
 *   const png = kb.exportPoster();
 *   kb.destroy();
 *
 * Or declaratively:  <open-keys text="hello" layout="dvorak" theme="dark"></open-keys>
 */

import { createEngine } from '../core/engine';
import { composeModules } from '../core/compose';
import { resolveConfig, LAYOUT_PRESETS, type OpenKeysConfig, type DeepPartial } from '../core/config';
import type { OpenKeysEngine, OpenKeysModule } from '../core/types';

export type OpenKeysInstance = OpenKeysEngine & { exportPoster(): string };

/**
 * Mount an OpenKeys visualization into `element` (which should have a non-zero size).
 * Pass the feature `modules` you want; the default is engine-only.
 */
export function createOpenKeys(
  element: HTMLElement,
  partial: DeepPartial<OpenKeysConfig> = {},
  modules: OpenKeysModule[] = []
): OpenKeysInstance {
  const config = resolveConfig(partial);
  const engine = createEngine(element, config);
  const teardownModules = composeModules(engine, element, modules);

  // replay-on-subscribe: fires immediately if the mesh is already built
  engine.on('ready', () => {
    const text = engine.currentText || config.text;
    if (text) engine.setText(text);
  });
  engine.start();

  return Object.assign(engine, {
    exportPoster: () => engine.exportImage(),
    destroy() {
      teardownModules();
      engine.destroy();
    },
  });
}

/** `<open-keys text="..." layout="qwerty|azerty|dvorak|numpad" theme="light|dark">` */
export class OpenKeysElement extends HTMLElement {
  private instance: OpenKeysInstance | null = null;

  static get observedAttributes() {
    return ['text', 'layout', 'theme'];
  }

  private readConfig(): DeepPartial<OpenKeysConfig> {
    const cfg: DeepPartial<OpenKeysConfig> = {};
    const text = this.getAttribute('text');
    if (text) cfg.text = text;
    const layout = this.getAttribute('layout');
    if (layout && LAYOUT_PRESETS[layout]) {
      cfg.layout = { rows: LAYOUT_PRESETS[layout], preset: layout as any };
    }
    const theme = this.getAttribute('theme');
    if (theme === 'light' || theme === 'dark') cfg.theme = { mode: theme };
    return cfg;
  }

  connectedCallback() {
    if (this.instance) return;
    if (!this.style.display) this.style.display = 'block';
    if (this.clientHeight === 0) this.style.height = '500px';

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    this.appendChild(container);

    this.instance = createOpenKeys(container, this.readConfig());
  }

  disconnectedCallback() {
    this.instance?.destroy();
    this.instance = null;
    this.replaceChildren();
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    if (!this.instance || oldVal === newVal) return;
    if (name === 'text') this.instance.setText(newVal || '');
    else if (name === 'theme' && (newVal === 'light' || newVal === 'dark')) {
      this.instance.setTheme(newVal);
    } else if (name === 'layout') {
      // layout change requires a rebuild — re-mount the element
      this.disconnectedCallback();
      this.connectedCallback();
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('open-keys')) {
  customElements.define('open-keys', OpenKeysElement);
}

// Public surface
export { createEngine } from '../core/engine';
export { composeModules } from '../core/compose';
export type { OpenKeysEngine, OpenKeysModule, OpenKeysEvents, Teardown, ModuleContext } from '../core/types';
export * from '../core/config';
