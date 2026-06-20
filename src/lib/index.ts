/**
 * OpenKeys — embeddable library entry point.
 *
 * The library ships the 3D visualization *engine* (scene + keyboard) with a small
 * programmatic API and an `<open-keys>` web component. The full app chrome
 * (navbar, font drawer, settings panel, poster modal) lives in the app, not here —
 * an embedder brings their own UI and drives the engine through this API.
 *
 *   import { createOpenKeys } from 'openkeys';
 *   const kb = createOpenKeys(document.getElementById('viz'), { text: 'hello', layout: { preset: 'dvorak', rows: DVORAK_ROWS } });
 *   kb.setText('world');
 *   const png = kb.exportPoster();
 *   kb.destroy();
 *
 * Or declaratively:
 *   <open-keys text="hello" layout="dvorak" theme="dark"></open-keys>
 */

import { Scene } from '../js/scene';
import { Keyboard } from '../js/keyboard';
import {
  resolveConfig,
  LAYOUT_PRESETS,
  type OpenKeysConfig,
  type DeepPartial,
} from '../js/config';

export interface OpenKeysInstance {
  /** Re-render heights from a text string (frequency mode). */
  setText(text: string): void;
  /** Drive heights directly from a label→value map (switches to static data mode). */
  setData(values: Record<string, number>): void;
  /** Toggle light/dark at runtime. */
  setTheme(mode: 'light' | 'dark'): void;
  /** Return the current frame as a PNG data URL. */
  exportPoster(): string;
  /** The resolved, live config object. */
  readonly config: OpenKeysConfig;
  /** Tear down: stop the loop, dispose GPU resources, remove the canvas and observers. */
  destroy(): void;
}

/**
 * Mount an OpenKeys visualization into `element`. The element should have a
 * non-zero size (the renderer fills it and follows it via ResizeObserver).
 */
export function createOpenKeys(
  element: HTMLElement,
  partial: DeepPartial<OpenKeysConfig> = {}
): OpenKeysInstance {
  const config = resolveConfig(partial);
  const scene = new Scene(config, element);
  const keyboard = new Keyboard(scene, config);

  const s = scene as any;
  let running = true;
  let rafId = 0;
  const loop = () => {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    keyboard.update();
    s.controls.update();
    s.renderer.render(s.scene, s.camera);
  };
  loop();

  const resize = () => scene.handleResize();
  const observer = new ResizeObserver(resize);
  observer.observe(element);

  if (config.text) {
    keyboard.setOnReady(() => keyboard.updateFromText(config.text));
  }

  return {
    config,
    setText(text: string) {
      config.data.mode = 'frequency';
      config.text = text;
      keyboard.setOnReady(() => keyboard.updateFromText(text));
    },
    setData(values: Record<string, number>) {
      config.data.mode = 'static';
      config.data.staticValues = values;
      keyboard.setOnReady(() => keyboard.processTextInput(''));
    },
    setTheme(mode: 'light' | 'dark') {
      config.theme.mode = mode;
      const dark = mode === 'dark';
      s.scene.background.set(dark ? config.theme.dark.background : config.theme.light.background);
      keyboard.updateTheme(dark);
      scene.updateFloorTheme(dark);
    },
    exportPoster() {
      return scene.generateImage();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(rafId);
      observer.disconnect();
      try {
        s.renderer.dispose();
        s.controls.dispose();
      } catch {
        /* ignore */
      }
      const canvas: HTMLCanvasElement | undefined = s.renderer?.domElement;
      canvas?.parentNode?.removeChild(canvas);
    },
  };
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
    }
    // `layout` changes require a rebuild — re-mount the element.
    else if (name === 'layout') {
      this.disconnectedCallback();
      this.connectedCallback();
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('open-keys')) {
  customElements.define('open-keys', OpenKeysElement);
}

// Re-export the config surface so embedders can build configs with full types.
export * from '../js/config';
