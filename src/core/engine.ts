/**
 * The OpenKeys engine: owns the Scene + Keyboard + the single animation loop,
 * holds authoritative state (currentText, activeFont, themeMode), and emits the
 * typed event contract. Modules and assemblies talk to this — never to the
 * scene/keyboard internals or the DOM.
 */
import * as THREE from 'three';
import { Scene } from './scene';
import { Keyboard } from './keyboard';
import { createEmitter } from './emitter';
import type { Unsubscribe } from './emitter';
import type { OpenKeysConfig, DeepPartial, DataMode, DataConfig } from './config';
import type { OpenKeysEngine, OpenKeysEvents, EventName } from './types';

/** Concrete engine — also exposes scene/keyboard for transitional internal use (modules use OpenKeysEngine). */
export interface EngineInternal extends OpenKeysEngine {
  readonly scene: Scene;
  readonly keyboard: Keyboard;
  readonly renderer: THREE.WebGLRenderer;
}

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof RegExp);
}

/** Deep-merge `source` INTO `target` in place (so holders of `target` see the change). */
function deepAssign(target: any, source: any): void {
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv === undefined) continue;
    if (isObject(sv) && isObject(target[key])) deepAssign(target[key], sv);
    else target[key] = sv;
  }
}

export function createEngine(host: HTMLElement, config: OpenKeysConfig): EngineInternal {
  const emitter = createEmitter<OpenKeysEvents>();
  const scene = new Scene(config, host);
  const keyboard = new Keyboard(scene, config, emitter.emit);

  let running = false;
  let rafId = 0;
  let currentText = '';
  let activeFont: { family: string; name: string } | null = null;
  let themeMode: 'light' | 'dark' = config.theme.mode;
  let built = keyboard.isBuilt;

  // ready: replay-on-subscribe. The engine owns the keyboard's single ready slot.
  keyboard.setOnReady(() => {
    built = true;
    emitter.emit('ready', { reason: 'init' });
  });

  const themeColors = () => (themeMode === 'dark' ? config.theme.dark : config.theme.light);

  const emitData = (text: string) => {
    const { counts, heights } = keyboard.snapshot();
    emitter.emit('data', { text, counts, heights, mode: config.data.mode });
  };

  const loop = () => {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    try {
      keyboard.update();
      scene.controls.update();
      scene.renderer.render(scene.scene, scene.camera);
    } catch (err) {
      console.error('OpenKeys loop error:', err);
      running = false; // stop on runtime error (parity with the old handleRuntimeError)
    }
  };

  const resize = () => scene.handleResize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  window.addEventListener('resize', resize);

  const engine: EngineInternal = {
    scene,
    keyboard,
    get renderer() {
      return scene.renderer;
    },
    get config() {
      return config;
    },
    get host() {
      return host;
    },
    get canvas() {
      return scene.renderer.domElement;
    },
    get currentText() {
      return currentText;
    },
    get activeFont() {
      return activeFont;
    },
    get themeMode() {
      return themeMode;
    },

    on<K extends EventName>(event: K, fn: (p: OpenKeysEvents[K]) => void): Unsubscribe {
      if (event === 'ready' && built) {
        (fn as (p: OpenKeysEvents['ready']) => void)({ reason: 'init' });
      }
      return emitter.on(event, fn);
    },

    setText(text) {
      currentText = text;
      keyboard.updateFromText(text);
      emitter.emit('textchange', {
        text,
        length: text.length,
        max: config.features.maxCharacters,
        source: 'program',
      });
      emitData(text);
    },

    setUserText(text) {
      currentText = text;
      keyboard.updateFromText(text);
      emitter.emit('textchange', {
        text,
        length: text.length,
        max: config.features.maxCharacters,
        source: 'user',
      });
      emitData(text);
    },

    async typeText(text) {
      emitter.emit('typingstart', { text });
      try {
        await keyboard.animateTypingSequence(text);
        currentText = text;
      } finally {
        emitter.emit('textchange', {
          text: currentText,
          length: currentText.length,
          max: config.features.maxCharacters,
          source: 'program',
        });
        emitData(currentText);
        emitter.emit('typingend', { text: currentText });
      }
    },

    async clear() {
      emitter.emit('typingstart', { text: currentText });
      try {
        await keyboard.clear(currentText);
        currentText = '';
      } finally {
        emitter.emit('textchange', {
          text: '',
          length: 0,
          max: config.features.maxCharacters,
          source: 'program',
        });
        emitData('');
        emitter.emit('typingend', { text: '' });
      }
    },

    setData(values) {
      config.data.mode = 'static';
      config.data.staticValues = values;
      keyboard.processTextInput('');
      emitData(currentText);
    },

    setDataMode(mode: DataMode, opts) {
      config.data.mode = mode;
      if (opts?.valueFn) config.data.valueFn = opts.valueFn as DataConfig['valueFn'];
      if (opts?.staticValues) config.data.staticValues = opts.staticValues;
      keyboard.updateFromText(currentText);
      emitData(currentText);
    },

    setTheme(mode) {
      themeMode = mode;
      const dark = mode === 'dark';
      scene.scene.background = new THREE.Color(themeColors().background);
      keyboard.updateTheme(dark);
      scene.updateFloorTheme(dark);
      emitter.emit('theme', { mode, colors: themeColors() });
    },

    setKeyCapFont(family, name) {
      keyboard.updateKeyCapFont(family, name);
      activeFont = { family, name };
      emitter.emit('font', { family, name });
    },

    setLayout(rows, preset) {
      config.layout.rows = rows;
      if (preset) config.layout.preset = preset;
      // Live rebuild is intentionally not performed here — the app uses a URL reload
      // for layout changes (parity). This keeps config + listeners in sync meanwhile.
      emitter.emit('config', { config });
      emitter.emit('ready', { reason: 'relayout' });
    },

    setConfig(partial: DeepPartial<OpenKeysConfig>) {
      deepAssign(config, partial);
      emitter.emit('config', { config });
    },

    setLightAngle(deg) {
      scene.updateLightPosition((deg * Math.PI) / 180);
    },

    increaseHeight() {
      keyboard.increaseHeight();
    },
    decreaseHeight() {
      keyboard.decreaseHeight();
    },

    exportImage() {
      return scene.generateImage(); // force-renders before toDataURL
    },

    resize,

    start() {
      if (running) return;
      running = true;
      loop();
    },
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    },
    destroy() {
      this.stop();
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      scene.dispose();
      emitter.clear();
    },
  };

  return engine;
}
