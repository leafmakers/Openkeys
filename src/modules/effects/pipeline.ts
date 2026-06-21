/**
 * The effects pipeline: one EffectComposer that owns the post chain and drives the
 * engine's render seam (`setPresenter`). It's an ordinary OpenKeysModule — the ONLY
 * core coupling is the presenter swap, restored on teardown.
 *
 * `createEffects([...passFactories])` returns `{ module, controller }`:
 *   - module     → compose it like any other module (it builds the composer)
 *   - controller → a live handle a UI drives (toggle/tune/mood/stats/export)
 *
 * Compose the module BEFORE any consumer of the controller (the panel), so the
 * composer exists when the consumer reads it.
 */
import * as THREE from 'three';
import { EffectComposer, RenderPass } from 'postprocessing';
import type { OpenKeysModule } from '../../core/types';
import type { EngineInternal } from '../../core/engine';
import { output as outputFactory } from './output';
import type {
  EffectContext,
  EffectPassFactory,
  EffectPassHandle,
  EffectsController,
  ParamValue,
  PassView,
} from './types';

const snapshot = (h: EffectPassHandle): Record<string, ParamValue> =>
  Object.fromEntries(Object.keys(h.schema).map((k) => [k, h.getOption(k)]));

type Saved = { name: string; enabled: boolean; values: Record<string, ParamValue> };

export function createEffects(
  factories: EffectPassFactory[]
): { module: OpenKeysModule; controller: EffectsController } {
  let mood = 1;
  let fps = 0;
  let frameMs = 0;

  // Set while the module is mounted; lets the controller reach the live composer.
  let bridge: { handles: () => EffectPassHandle[]; applyMoodAll: () => void } | null = null;
  const find = (name: string) => bridge?.handles().find((h) => h.name === name);

  const module: OpenKeysModule = (ctx) => {
    const e = ctx.engine as unknown as EngineInternal;
    const renderer = e.renderer;
    const sceneObj = e.scene.scene;

    // Move tone mapping off the renderer so the effect chain sees linear HDR; the
    // output pass re-applies it. Restored on teardown.
    const prevToneMapping = renderer.toneMapping;
    const prevExposure = renderer.toneMappingExposure;
    renderer.toneMapping = THREE.NoToneMapping;

    let handles: EffectPassHandle[] = [];
    let composer!: EffectComposer;
    let camera!: THREE.Camera;

    const mirrorSize = () => {
      const s = renderer.getSize(new THREE.Vector2());
      composer.setSize(s.x, s.y);
    };

    const build = (restoreFrom?: Saved[]) => {
      camera = e.scene.camera;
      composer = new EffectComposer(renderer, {
        frameBufferType: THREE.HalfFloatType, // keeps values >1 for true HDR bloom
        multisampling: e.config.scene.antialias ? 4 : 0, // MSAA inside the composed path
      });
      composer.addPass(new RenderPass(sceneObj, camera));

      const fxCtx: EffectContext = { scene: sceneObj, camera, renderer, engine: ctx.engine };
      handles = [...factories.map((f) => f.create(fxCtx)), outputFactory.create(fxCtx)];
      for (const h of handles) composer.addPass(h.pass);

      mirrorSize();

      if (restoreFrom) {
        for (const p of restoreFrom) {
          const h = handles.find((x) => x.name === p.name);
          if (!h) continue;
          for (const [k, v] of Object.entries(p.values)) h.setOption(k, v);
          if (h.toggleable) h.setEnabled(p.enabled);
        }
      }
      for (const h of handles) h.applyMood(mood);
    };

    // A projection swap replaces scene.camera, so rebuild the chain against the new
    // one (cheap, happens only on toggle), preserving all current settings.
    const rebuild = () => {
      const prev: Saved[] = handles.map((h) => ({ name: h.name, enabled: h.isEnabled(), values: snapshot(h) }));
      composer.dispose();
      for (const h of handles) h.dispose();
      build(prev);
    };

    build();

    const present = () => {
      if (e.scene.camera !== camera) rebuild();
      composer.render();
    };
    ctx.engine.setPresenter(present);

    const ro = new ResizeObserver(() => mirrorSize());
    ro.observe(ctx.host);

    // FPS / frame-time meter (independent of the engine loop).
    let last = performance.now();
    let acc = 0;
    let frames = 0;
    let raf = requestAnimationFrame(function tick() {
      const now = performance.now();
      acc += now - last;
      last = now;
      frames++;
      if (acc >= 500) {
        fps = Math.round((frames * 1000) / acc);
        frameMs = Math.round((acc / frames) * 10) / 10;
        acc = 0;
        frames = 0;
      }
      raf = requestAnimationFrame(tick);
    });

    bridge = {
      handles: () => handles,
      applyMoodAll: () => { for (const h of handles) h.applyMood(mood); },
    };

    return () => {
      bridge = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      ctx.engine.setPresenter(null);
      composer.dispose();
      for (const h of handles) h.dispose();
      renderer.toneMapping = prevToneMapping;
      renderer.toneMappingExposure = prevExposure;
    };
  };

  const controller: EffectsController = {
    ready: () => bridge !== null,
    list: (): PassView[] =>
      (bridge?.handles() ?? []).map((h) => ({
        name: h.name,
        label: h.label,
        schema: h.schema,
        toggleable: h.toggleable,
        enabled: h.isEnabled(),
        values: snapshot(h),
      })),
    setEnabled: (name, on) => find(name)?.setEnabled(on),
    setOption: (name, key, value) => find(name)?.setOption(key, value),
    getOption: (name, key) => find(name)?.getOption(key),
    setMood: (v) => { mood = v; bridge?.applyMoodAll(); },
    getMood: () => mood,
    stats: () => ({ fps, ms: frameMs }),
    exportState: () =>
      (bridge?.handles() ?? []).reduce(
        (acc, h) => {
          (acc.passes as Record<string, unknown>)[h.name] = { enabled: h.isEnabled(), values: snapshot(h) };
          return acc;
        },
        { mood, passes: {} as Record<string, unknown> }
      ),
  };

  return { module, controller };
}
