/**
 * Effects building-block contracts.
 *
 * An EffectPassFactory produces a self-describing EffectPassHandle: it owns one or
 * more postprocessing `Effect`s wrapped in a `Pass`, exposes a `schema` (so any UI
 * can be generated from it — no hand-wiring), and knows how to live-update itself.
 * The pipeline owns the EffectComposer and the master "mood" dosage; passes stay
 * dumb and composable.
 */
import type * as THREE from 'three';
import type { Pass } from 'postprocessing';
import type { OpenKeysEngine } from '../../core/types';

export type ParamValue = number | boolean | string;

export interface ParamSpec {
  type: 'range' | 'toggle' | 'select';
  label: string;
  default: ParamValue;
  /** range */
  min?: number;
  max?: number;
  step?: number;
  /** select */
  options?: string[];
  /** Optional one-line hint shown under the control. */
  hint?: string;
}

export type Schema = Record<string, ParamSpec>;

/** Everything a pass factory needs. `camera` is the live camera at build time; on a
 *  projection swap the pipeline rebuilds, so passes never hold a stale camera. */
export interface EffectContext {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  engine: OpenKeysEngine;
}

export interface EffectPassHandle {
  readonly name: string;
  readonly label: string;
  readonly schema: Schema;
  /** Output/grade is always on; bloom & god-rays toggle. */
  readonly toggleable: boolean;
  /** The postprocessing pass to add to the composer chain. */
  readonly pass: Pass;
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
  setOption(key: string, value: ParamValue): void;
  getOption(key: string): ParamValue;
  /** Master dosage 0..1 — multiplies this pass's blend strength. */
  applyMood(mood: number): void;
  dispose(): void;
}

export interface EffectPassFactory {
  readonly name: string;
  create(ctx: EffectContext): EffectPassHandle;
}

/** A flattened view of a pass for building UI. */
export interface PassView {
  name: string;
  label: string;
  schema: Schema;
  toggleable: boolean;
  enabled: boolean;
  values: Record<string, ParamValue>;
}

/** Live handle the tweak panel (or any consumer UI) drives. */
export interface EffectsController {
  ready(): boolean;
  list(): PassView[];
  setEnabled(name: string, on: boolean): void;
  setOption(name: string, key: string, value: ParamValue): void;
  getOption(name: string, key: string): ParamValue | undefined;
  setMood(v: number): void;
  getMood(): number;
  /** Live FPS / frame-time, measured by the pipeline. */
  stats(): { fps: number; ms: number };
  /** Current full state as a plain object (copy-as-JSON → becomes a preset). */
  exportState(): unknown;
}
