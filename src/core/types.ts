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
  Cell,
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
  setLayout(rows: Cell[][], preset?: LayoutConfig['preset']): void;
  setConfig(partial: DeepPartial<OpenKeysConfig>): void;
  setLightAngle(deg: number): void;
  increaseHeight(): void;
  decreaseHeight(): void;

  /** Force-renders before reading pixels, regardless of loop state. */
  exportImage(): string;
  resize(): void;

  start(): void;
  stop(): void;
  destroy(): void;
}
