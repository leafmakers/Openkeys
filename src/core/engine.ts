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
import { tapSlop } from './utils';
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

  // Render/present seam: post-processing modules swap this to drive an EffectComposer.
  // Default presents the scene straight to the screen — identical to the original loop.
  const directPresent = () => scene.renderer.render(scene.scene, scene.camera);
  let present: () => void = directPresent;

  const loop = () => {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    try {
      keyboard.update();
      scene.controls.update();
      present();
    } catch (err) {
      console.error('OpenKeys loop error:', err);
      running = false; // stop on runtime error (parity with the old handleRuntimeError)
    }
  };

  const resize = () => scene.handleResize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  window.addEventListener('resize', resize);

  // Click-to-act on 3D keys (currently: the delete key proxies a text clear).
  // Assigned after the engine literal so it can reference engine.clear().
  let detachPointer = () => {};

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

    hasKey(label) {
      return keyboard.hasKey(label);
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
      keyboard.updateTheme(dark);
      scene.updateFloorTheme(dark); // owns the scene background (floor-matched)
      keyboard.updateBoundary(); // re-theme the floor boundary stroke
      emitter.emit('theme', { mode, colors: themeColors() });
    },

    setKeyCapFont(family, name) {
      keyboard.updateKeyCapFont(family, name);
      activeFont = { family, name };
      emitter.emit('font', { family, name });
    },

    setTextSize(size) {
      const s = Math.max(0.5, Math.min(6, size));
      config.typography.textSize = s;
      keyboard.setTextSize(s); // recreates label geometry
      emitter.emit('config', { config });
    },

    setLabelAnchor(anchor) {
      config.typography.labelAnchor = anchor;
      keyboard.setLabelAnchor(anchor);
      emitter.emit('config', { config });
    },

    setLabelWeight(weight) {
      const w = Math.max(0.5, Math.min(2, weight));
      config.typography.labelWeight = w;
      keyboard.setLabelWeight(w);
      emitter.emit('config', { config });
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

    setStructuralKeyOpacity(opacity) {
      const o = Math.max(0, Math.min(1, opacity));
      config.layout.structuralKeyOpacity = o;
      keyboard.setStructuralKeyOpacity(o); // live, no rebuild
      emitter.emit('config', { config });
    },

    setStructuralKeyHeight(height) {
      const h = Math.max(0, height);
      config.layout.structuralKeyHeight = h;
      keyboard.setStructuralKeyHeight(h); // live, picked up by the per-frame idle pass
      emitter.emit('config', { config });
    },

    setMainKeyHeight(height) {
      const h = Math.max(0, height);
      config.layout.mainKeyHeight = h;
      keyboard.setMainKeyHeight(h); // live, picked up by the per-frame idle pass
      emitter.emit('config', { config });
    },

    setRisePerTap(rise) {
      const r = Math.max(0, rise);
      config.data.growthIncrement = r;
      keyboard.setRisePerTap(r); // live, picked up by the per-frame idle pass
      emitter.emit('config', { config });
    },

    setMaxKeyHeight(height) {
      const h = Math.max(0, height);
      config.data.maxKeyHeight = h;
      keyboard.setMaxKeyHeight(h); // live, picked up by the per-frame idle pass
      emitter.emit('config', { config });
    },

    setFaceOpacity(opacity) {
      const o = Math.max(0, Math.min(1, opacity));
      config.appearance.faceOpacity = o;
      keyboard.setFaceOpacity(o); // live, no rebuild
      emitter.emit('config', { config });
    },

    setWallOpacity(opacity) {
      const o = Math.max(0, Math.min(1, opacity));
      config.appearance.wallOpacity = o;
      keyboard.setWallOpacity(o); // live, no rebuild
      emitter.emit('config', { config });
    },

    setOutlineOpacity(opacity) {
      const o = Math.max(0, Math.min(1, opacity));
      config.appearance.outlineOpacity = o;
      keyboard.setOutlineOpacity(o); // live, no rebuild
      emitter.emit('config', { config });
    },

    setTextOpacity(opacity) {
      const o = Math.max(0, Math.min(1, opacity));
      config.appearance.textOpacity = o;
      keyboard.setTextOpacity(o); // live, no rebuild
      emitter.emit('config', { config });
    },

    setExtraFaceOpacity(opacity) {
      const o = Math.max(0, Math.min(1, opacity));
      config.appearance.extraFaceOpacity = o;
      keyboard.setExtraFaceOpacity(o); // live, no rebuild
      emitter.emit('config', { config });
    },

    setExtraWallOpacity(opacity) {
      const o = Math.max(0, Math.min(1, opacity));
      config.appearance.extraWallOpacity = o;
      keyboard.setExtraWallOpacity(o); // live, no rebuild
      emitter.emit('config', { config });
    },

    setExtraOutlineOpacity(opacity) {
      const o = Math.max(0, Math.min(1, opacity));
      config.appearance.extraOutlineOpacity = o;
      keyboard.setExtraOutlineOpacity(o); // live, no rebuild
      emitter.emit('config', { config });
    },

    setExtraTextOpacity(opacity) {
      const o = Math.max(0, Math.min(1, opacity));
      config.appearance.extraTextOpacity = o;
      keyboard.setExtraTextOpacity(o); // live, no rebuild
      emitter.emit('config', { config });
    },

    highlightKey(label, color) {
      keyboard.highlightKey(label, color);
    },
    clearHighlight() {
      keyboard.clearHighlight();
    },

    setBoundary(partial) {
      Object.assign(config.scene.boundary, partial);
      keyboard.updateBoundary(); // live, no rebuild
      emitter.emit('config', { config });
    },

    setLightAngle(deg) {
      scene.updateLightPosition((deg * Math.PI) / 180);
    },

    setCameraControls(partial) {
      scene.setControls(partial); // merges into config.camera.controls + applies live
      emitter.emit('config', { config });
    },

    resetCameraView() {
      scene.resetView();
    },

    getOrbit() {
      return scene.getOrbit();
    },

    setOrbit(azimuth, polar) {
      scene.orbitTo(azimuth, polar);
    },

    setProjection(projection) {
      scene.setProjection(projection); // live camera+controls swap
      emitter.emit('config', { config });
    },

    setCameraFov(fov) {
      scene.setFov(fov); // live, perspective only
      emitter.emit('config', { config });
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

    setPresenter(fn) {
      present = fn ?? directPresent;
    },

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
      detachPointer();
      scene.dispose();
      emitter.clear();
    },
  };

  // Click-to-act on 3D keys. The delete key is the one interactive key: hovering it
  // shows a subtle "delete red" tint + pointer cursor (discoverability); a tap (not an
  // orbit drag) presses it down and clears the text.
  const DELETE_ACCENT = '#ff453a'; // iOS-style red — subtle as a highlightKey tint, reads as "delete"
  const canvas = scene.renderer.domElement;

  const ndcFromEvent = (e: PointerEvent): THREE.Vector2 => {
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
  };

  let downX = 0;
  let downY = 0;
  // The key currently under the cursor. The engine is the single owner of the
  // hover highlight's *clear*: on every change it clears, sets the delete-key red
  // itself, and emits `hover` so views (the character bar) can tint data keys in
  // their own colour. This keeps the two hover sources from stomping each other.
  let hoveredKeyId: string | null = null;
  const setHoveredKey = (keyId: string | null) => {
    if (keyId === hoveredKeyId) return;
    hoveredKeyId = keyId;
    keyboard.clearHighlight();
    const deleteId = keyboard.deleteKeyId();
    if (keyId && keyId === deleteId) {
      keyboard.highlightKey(deleteId, DELETE_ACCENT); // click affordance for the delete key
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = '';
    }
    // Let listeners (character bar) mirror the hover for non-delete keys.
    emitter.emit('hover', { keyId });
  };

  const onPointerDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
  };
  const onPointerMove = (e: PointerEvent) => {
    // Hover affordance is a mouse concept; skip the per-move raycast for touch.
    if (e.pointerType === 'touch') return;
    setHoveredKey(keyboard.pickKeyId(ndcFromEvent(e), scene.camera));
  };
  const onPointerLeave = () => setHoveredKey(null);
  const onPointerUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > tapSlop(e.pointerType)) return; // was an orbit drag
    const deleteId = keyboard.deleteKeyId();
    if (deleteId && keyboard.pickKeyId(ndcFromEvent(e), scene.camera) === deleteId) {
      // Consume the tap so text-input's canvas pointerup (added later on this same
      // element) doesn't ALSO focus the field + raise the soft keyboard after we clear.
      e.stopImmediatePropagation();
      // Touch has no hover, so apply the red for the tap and remove it after the press.
      const hadHover = hoveredKeyId === deleteId;
      if (!hadHover) keyboard.highlightKey(deleteId, DELETE_ACCENT);
      void keyboard.pressKey(deleteId).then(() => {
        if (!hadHover) keyboard.clearHighlight();
      });
      void engine.clear();
    }
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerup', onPointerUp);
  detachPointer = () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointerup', onPointerUp);
  };

  return engine;
}
