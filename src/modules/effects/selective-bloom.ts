/**
 * Selective bloom: only chosen meshes (engraved legends and/or key caps) glow —
 * not the whole frame by luminance. To make a selection actually cross the bloom
 * threshold we lift its `emissive` on setup and RESTORE it on teardown, so the
 * keyboard's base materials are untouched unless this effect is mounted.
 *
 * Runs in linear HDR (the pipeline moves tone mapping to the output pass), so only
 * the boosted legends bloom — the tasteful, non-washed-out result.
 */
import * as THREE from 'three';
import { EffectPass, SelectiveBloomEffect } from 'postprocessing';
import type { Unsubscribe } from '../../core/emitter';
import type { EffectContext, EffectPassFactory, EffectPassHandle, ParamValue, Schema } from './types';

const SCHEMA: Schema = {
  strength: { type: 'range', label: 'Strength (master blend)', default: 0.85, min: 0, max: 1, step: 0.01 },
  intensity: { type: 'range', label: 'Intensity', default: 1.0, min: 0, max: 3, step: 0.05 },
  threshold: { type: 'range', label: 'Luminance threshold', default: 0.4, min: 0, max: 1, step: 0.01 },
  smoothing: { type: 'range', label: 'Threshold smoothing', default: 0.3, min: 0, max: 1, step: 0.01 },
  glow: { type: 'range', label: 'Legend glow (emissive)', default: 1.6, min: 0, max: 4, step: 0.05,
    hint: 'Brightens the selection so it blooms. Reads best in dark theme.' },
  target: { type: 'select', label: 'What glows', default: 'legends', options: ['legends', 'caps', 'both'] },
};

interface Boost {
  mat: THREE.MeshStandardMaterial;
  emissive: THREE.Color | null;
  intensity: number;
}

export const selectiveBloom: EffectPassFactory = {
  name: 'bloom',
  create(ctx: EffectContext): EffectPassHandle {
    const values: Record<string, ParamValue> = Object.fromEntries(
      Object.entries(SCHEMA).map(([k, s]) => [k, s.default])
    );
    let mood = 1;

    const effect = new SelectiveBloomEffect(ctx.scene, ctx.camera, {
      mipmapBlur: true, // multi-scale (Jimenez-style) soft falloff, not a single gaussian
      intensity: values.intensity as number,
      luminanceThreshold: values.threshold as number,
      luminanceSmoothing: values.smoothing as number,
      radius: 0.7,
    });
    (effect as any).inverted = false;
    (effect as any).ignoreBackground = true; // bloom the selection, never the backdrop

    const pass = new EffectPass(ctx.camera, effect);
    pass.enabled = true;

    const boosts: Boost[] = [];
    const restoreBoosts = () => {
      for (const b of boosts) {
        if (b.mat.emissive && b.emissive) b.mat.emissive.copy(b.emissive);
        b.mat.emissiveIntensity = b.intensity;
        b.mat.needsUpdate = true;
      }
      boosts.length = 0;
    };

    // (Re)pick the glowing meshes and (re)apply the emissive boost. Safe to call on
    // every keyboard rebuild / theme change — restores the prior boost first.
    const reselect = () => {
      restoreBoosts();
      effect.selection.clear();
      const target = values.target as string;
      const glow = values.glow as number;

      ctx.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const ownKeyId = (mesh as any).userData?.keyId as string | undefined;
        const parentKeyId = (mesh.parent as any)?.userData?.keyId as string | undefined;
        const isLegend = !ownKeyId && !!parentKeyId; // engraved text is a child of a key mesh
        const isCap = !!ownKeyId;
        const want =
          (target === 'legends' && isLegend) ||
          (target === 'caps' && isCap) ||
          (target === 'both' && (isLegend || isCap));
        if (!want) return;

        effect.selection.add(mesh);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const sm = m as THREE.MeshStandardMaterial;
          if (!sm || !('emissive' in sm)) continue; // MeshBasic caps (dark theme) have none — skip
          boosts.push({ mat: sm, emissive: sm.emissive ? sm.emissive.clone() : null, intensity: sm.emissiveIntensity ?? 1 });
          if (sm.emissive && (sm as any).color) sm.emissive.copy((sm as any).color); // glow in-hue
          sm.emissiveIntensity = glow;
          sm.needsUpdate = true;
        }
      });
    };

    // Re-target whenever the mesh is (re)built or the theme swaps its materials.
    const offReady: Unsubscribe = ctx.engine.on('ready', reselect);
    const offTheme: Unsubscribe = ctx.engine.on('theme', reselect);
    reselect();

    const setOption = (key: string, value: ParamValue) => {
      values[key] = value;
      switch (key) {
        case 'intensity': effect.intensity = value as number; break;
        case 'threshold': (effect.luminanceMaterial as any).threshold = value as number; break;
        case 'smoothing': (effect.luminanceMaterial as any).smoothing = value as number; break;
        case 'strength': effect.blendMode.opacity.value = (value as number) * mood; break;
        case 'glow':
        case 'target': reselect(); break;
      }
    };

    const applyMood = (m: number) => {
      mood = m;
      effect.blendMode.opacity.value = (values.strength as number) * mood;
    };
    applyMood(1);

    return {
      name: 'bloom',
      label: 'Selective Bloom',
      schema: SCHEMA,
      toggleable: true,
      pass,
      // Toggling off also drops the emissive boost, so "None" is a true baseline
      // (otherwise legends would stay artificially bright with no bloom to justify it).
      setEnabled: (on) => {
        pass.enabled = on;
        if (on) reselect();
        else restoreBoosts();
      },
      isEnabled: () => pass.enabled,
      setOption,
      getOption: (k) => values[k],
      applyMood,
      dispose: () => {
        offReady();
        offTheme();
        restoreBoosts();
        effect.dispose();
      },
    };
  },
};
