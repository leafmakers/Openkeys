/**
 * Core type contracts: the engine event map, the engine public API, and the
 * module interface. Implemented by core/engine.ts; consumed by modules + assemblies.
 */
import type { Unsubscribe } from './emitter';
import type {
  OpenKeysConfig,
  DeepPartial,
  DataMode,
  DataConfig,
  ThemeColors,
  LayoutConfig,
  OrbitControlsConfig,
  Cell,
  LabelAnchor,
} from './config';

/**
 * The full typed event contract. Each event maps 1:1 to a real coupling.
 */
export interface OpenKeysEvents {
  /**
   * Keyboard mesh built or rebuilt. REPLAY-ON-SUBSCRIBE: a listener added after the
   * build fires immediately, so ordering against start() never matters.
   * `reason` distinguishes the first build from a live re-layout.
   */
  ready: { reason: 'init' | 'relayout' };

  /**
   * Text changed. `source` tells a text view whether to write the DOM node:
   *  - 'program': engine drove the change (setText/typeText/clear) — view writes textContent + counter.
   *  - 'user': the user typed into a contenteditable (browser already wrote it) — view updates the
   *            counter/placeholder ONLY; rewriting textContent would collapse the caret.
   */
  textchange: { text: string; length: number; max: number; source: 'user' | 'program' };

  /**
   * Per-key values changed (replaces the old global CustomEvent('updateCharacterBar')).
   * `counts`/`heights` are mode-correct: frequency → occurrences; static/custom → computeValue output.
   */
  data: {
    text: string;
    counts: Record<string, number>;
    heights: Record<string, number>;
    mode: DataMode;
  };

  /** Engine applied its three theme sinks (scene bg, floor, keyboard). */
  theme: { mode: 'light' | 'dark'; colors: ThemeColors };

  /** Active keycap font changed (poster reads engine.activeFont for its title). */
  font: { family: string; name: string };

  /** Animation envelope — guaranteed via try/finally around type/backspace sequences. */
  typingstart: { text: string };
  typingend: { text: string };

  /** Config merged (after setConfig/setLayout). Settings UI re-reads to reflect live state. */
  config: { config: Readonly<OpenKeysConfig> };

  /**
   * Pointer hover over a 3D key changed (null = nothing under the cursor). Lets
   * views (e.g. the character bar) mirror the hover both ways. Emitted only on
   * change, mouse-only.
   */
  hover: { keyId: string | null };
}

export type EventName = keyof OpenKeysEvents;

export type Teardown = () => void;

/** Context handed to each module factory. `engine.config` is live — never cache a copy. */
export interface ModuleContext {
  engine: OpenKeysEngine;
  /** The element to scope DOM to (build into it, or querySelector `[data-ok-role]` within it). */
  host: HTMLElement;
  /** Aborted on teardown — pass to addEventListener({ signal }) for automatic cleanup. */
  signal: AbortSignal;
}

/** A feature module: a plain factory that wires itself up and returns its teardown. */
export type OpenKeysModule = (ctx: ModuleContext) => Teardown;

/** The pure engine: owns scene + keyboard + the single animation loop, and emits events. */
export interface OpenKeysEngine {
  /** Live config — modules read this, never a captured copy. */
  readonly config: Readonly<OpenKeysConfig>;
  readonly host: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  /** Authoritative typed/displayed text (replaces reading it back out of the DOM). */
  readonly currentText: string;
  /** Active keycap font for poster titles; null → degrade to the default. */
  readonly activeFont: { family: string; name: string } | null;
  /** Current resolved theme mode. */
  readonly themeMode: 'light' | 'dark';

  on<K extends EventName>(event: K, fn: (payload: OpenKeysEvents[K]) => void): Unsubscribe;

  /** Whether a label has a key in the current layout (for type-anywhere). */
  hasKey(label: string): boolean;

  /** Programmatic text set — synchronous keyboard update; emits textchange{program} + data. */
  setText(text: string): void;
  /** User-path text set — drives keyboard + emits data + textchange{user} (no DOM write-back). */
  setUserText(text: string): void;
  /** Animated typing; per-step textchange{program}+data; brackets with typingstart/typingend. */
  typeText(text: string): Promise<void>;
  /** Animated backspace clear; uses engine.currentText, not the DOM. */
  clear(): Promise<void>;

  setData(values: Record<string, number>): void;
  setDataMode(
    mode: DataMode,
    opts?: { valueFn?: DataConfig['valueFn']; staticValues?: Record<string, number> }
  ): void;

  setTheme(mode: 'light' | 'dark'): void;
  setKeyCapFont(family: string, name: string): void;
  /** Engraved-letter size, placement on the cap, and stroke weight (recreate labels). */
  setTextSize(size: number): void;
  setLabelAnchor(anchor: LabelAnchor): void;
  setLabelWeight(weight: number): void;
  setLayout(rows: Cell[][], preset?: LayoutConfig['preset']): void;
  setConfig(partial: DeepPartial<OpenKeysConfig>): void;
  /** Live-set the opacity (0–1) of structural (non-data) keys. */
  setStructuralKeyOpacity(opacity: number): void;
  /** Live-set the resting height (key-height units) of structural (non-data) keys. */
  setStructuralKeyHeight(height: number): void;
  /** Live-set the starting/resting height (key-height units) of the data (main 36) keys. */
  setMainKeyHeight(height: number): void;
  /** Live-set the base rise per tap (height per occurrence, before proportional auto-scaling). */
  setRisePerTap(rise: number): void;
  /** Live-set the composition ceiling — the tallest data key auto-scales to fit it (0 = uncapped). */
  setMaxKeyHeight(height: number): void;
  /** Live-set the data (main 36) key top-face opacity multiplier (0–1). */
  setFaceOpacity(opacity: number): void;
  /** Live-set the data (main 36) key side-wall opacity multiplier (0–1). */
  setWallOpacity(opacity: number): void;
  /** Live-set the data-key edge + base outline opacity multiplier (0–1). */
  setOutlineOpacity(opacity: number): void;
  /** Live-set the data-key engraved-label opacity multiplier (0–1). */
  setTextOpacity(opacity: number): void;
  /** Live-set the structural (extra) key top-face opacity multiplier (0–1). */
  setExtraFaceOpacity(opacity: number): void;
  /** Live-set the structural (extra) key side-wall opacity multiplier (0–1). */
  setExtraWallOpacity(opacity: number): void;
  /** Live-set the structural-key edge + base outline opacity multiplier (0–1). */
  setExtraOutlineOpacity(opacity: number): void;
  /** Live-set the structural-key engraved-label opacity multiplier (0–1). */
  setExtraTextOpacity(opacity: number): void;
  /** Spotlight a single key with a subtle accent in `color` (e.g. on bar hover). */
  highlightKey(label: string, color: string): void;
  /** Remove the current hover spotlight. */
  clearHighlight(): void;
  /** Live-update the floor boundary outline (enabled / gap / radius / opacity). */
  setBoundary(partial: Partial<OpenKeysConfig['scene']['boundary']>): void;
  setLightAngle(deg: number): void;
  /** Live-update OrbitControls constraints (orbit/zoom/pan locks, damping, auto-rotate). */
  setCameraControls(partial: Partial<OrbitControlsConfig>): void;
  /** Snap the camera back to its configured placement, zoom and target. */
  resetCameraView(): void;
  /** Current camera orbit angles (radians) relative to the target. */
  getOrbit(): { azimuth: number; polar: number };
  /** Orbit the camera to an azimuth/polar (radians); polar is clamped to the limits. */
  setOrbit(azimuth: number, polar: number): void;
  /** Live-swap the camera projection (orthographic ⇆ perspective). */
  setProjection(projection: 'orthographic' | 'perspective'): void;
  /** Live-set the perspective field of view in degrees (no-op for orthographic). */
  setCameraFov(fov: number): void;
  increaseHeight(): void;
  decreaseHeight(): void;

  /** Force-renders before reading pixels, regardless of loop state. */
  exportImage(): string;
  resize(): void;

  /**
   * Render/present seam for post-processing. The engine's loop calls the presenter
   * once per frame in place of its direct `renderer.render(scene, camera)`. A
   * post-processing module swaps in its own (e.g. an EffectComposer's render);
   * passing `null` restores the default direct render. This is the ONLY hook the
   * compositing stack needs in core — effects otherwise stay ordinary modules.
   */
  setPresenter(present: (() => void) | null): void;

  start(): void;
  stop(): void;
  destroy(): void;
}
