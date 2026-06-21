/**
 * Volumetric god rays (screen-space, depth-masked): light shafts raking through the
 * board from a bright sun proxy. Unlike bloom this is genuinely depth-aware — the
 * keys occlude the source, which is what carves the shafts. Reads best with a
 * PERSPECTIVE camera, a darker backdrop, and the sun partly hidden behind the keys.
 *
 * Heavier than bloom (per-pixel radial samples) — the `samples` knob is the cost dial.
 * Off by default: god rays are the opt-in atmosphere layer, not the everyday look.
 */
import * as THREE from 'three';
import { EffectPass, GodRaysEffect } from 'postprocessing';
import type { EffectContext, EffectPassFactory, EffectPassHandle, ParamValue, Schema } from './types';

const SCHEMA: Schema = {
  strength: { type: 'range', label: 'Strength (master blend)', default: 0.7, min: 0, max: 1, step: 0.01 },
  density: { type: 'range', label: 'Density', default: 0.96, min: 0, max: 1, step: 0.005 },
  decay: { type: 'range', label: 'Decay', default: 0.92, min: 0, max: 1, step: 0.005 },
  weight: { type: 'range', label: 'Weight', default: 0.4, min: 0, max: 1, step: 0.01 },
  exposure: { type: 'range', label: 'Exposure', default: 0.5, min: 0, max: 1, step: 0.01 },
  samples: { type: 'range', label: 'Samples (cost)', default: 60, min: 16, max: 120, step: 4,
    hint: 'Quality vs. GPU cost. Watch the FPS meter as you raise it.' },
  sunSize: { type: 'range', label: 'Sun size', default: 12, min: 1, max: 40, step: 1 },
  azimuth: { type: 'range', label: 'Sun azimuth°', default: -60, min: -180, max: 180, step: 1 },
  elevation: { type: 'range', label: 'Sun elevation°', default: 35, min: 0, max: 90, step: 1 },
  sunDistance: { type: 'range', label: 'Sun distance', default: 240, min: 60, max: 500, step: 5 },
};

export const godRays: EffectPassFactory = {
  name: 'godrays',
  create(ctx: EffectContext): EffectPassHandle {
    const values: Record<string, ParamValue> = Object.fromEntries(
      Object.entries(SCHEMA).map(([k, s]) => [k, s.default])
    );
    let mood = 1;

    // The light source: a transparent, non-depth-writing sphere the rays emanate from.
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })
    );
    sun.frustumCulled = false;
    sun.visible = false; // shown only while the pass is enabled
    ctx.scene.add(sun);

    const placeSun = () => {
      const az = ((values.azimuth as number) * Math.PI) / 180;
      const el = ((values.elevation as number) * Math.PI) / 180;
      const r = values.sunDistance as number;
      // orbit the board centre (~y 30)
      sun.position.set(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r + 20, Math.cos(el) * Math.cos(az) * r);
      sun.scale.setScalar(values.sunSize as number);
    };
    placeSun();

    const effect = new GodRaysEffect(ctx.camera, sun, {
      samples: values.samples as number,
      density: values.density as number,
      decay: values.decay as number,
      weight: values.weight as number,
      exposure: values.exposure as number,
      blur: true,
    });

    const pass = new EffectPass(ctx.camera, effect);
    pass.enabled = false; // opt-in

    const mat = effect.godRaysMaterial as any;
    const setOption = (key: string, value: ParamValue) => {
      values[key] = value;
      switch (key) {
        case 'density': mat.density = value as number; break;
        case 'decay': mat.decay = value as number; break;
        case 'weight': mat.weight = value as number; break;
        case 'exposure': mat.exposure = value as number; break;
        case 'samples': effect.samples = value as number; break;
        case 'strength': effect.blendMode.opacity.value = (value as number) * mood; break;
        case 'sunSize':
        case 'azimuth':
        case 'elevation':
        case 'sunDistance': placeSun(); break;
      }
    };

    const applyMood = (m: number) => {
      mood = m;
      effect.blendMode.opacity.value = (values.strength as number) * mood;
    };
    applyMood(1);

    return {
      name: 'godrays',
      label: 'Volumetric God Rays',
      schema: SCHEMA,
      toggleable: true,
      pass,
      setEnabled: (on) => { pass.enabled = on; sun.visible = on; },
      isEnabled: () => pass.enabled,
      setOption,
      getOption: (k) => values[k],
      applyMood,
      dispose: () => {
        ctx.scene.remove(sun);
        sun.geometry.dispose();
        (sun.material as THREE.Material).dispose();
        effect.dispose();
      },
    };
  },
};
