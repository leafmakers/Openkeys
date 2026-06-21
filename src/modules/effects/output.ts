/**
 * Output / grade — always the LAST pass. Two jobs:
 *  1. Tone mapping. The pipeline disables the renderer's tone mapping so bloom and
 *     god rays operate on linear HDR; we re-apply it here, at the end. AgX is the
 *     tasteful modern default (gentle, neutral roll-off); ACES and Neutral offered too.
 *  2. A whisper of film grain — the single cheapest fix for 8-bit gradient banding,
 *     which is what makes web gradients look "vectory".
 */
import { BlendFunction, EffectPass, NoiseEffect, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import type { EffectContext, EffectPassFactory, EffectPassHandle, ParamValue, Schema } from './types';

const SCHEMA: Schema = {
  tone: { type: 'select', label: 'Tone mapping', default: 'agx', options: ['agx', 'aces', 'neutral'] },
  grain: { type: 'range', label: 'Film grain (hides banding)', default: 0.04, min: 0, max: 0.25, step: 0.005 },
};

const modeFor = (s: string): ToneMappingMode =>
  s === 'aces' ? ToneMappingMode.ACES_FILMIC : s === 'neutral' ? ToneMappingMode.NEUTRAL : ToneMappingMode.AGX;

export const output: EffectPassFactory = {
  name: 'output',
  create(ctx: EffectContext): EffectPassHandle {
    const values: Record<string, ParamValue> = Object.fromEntries(
      Object.entries(SCHEMA).map(([k, s]) => [k, s.default])
    );

    const tone = new ToneMappingEffect({ mode: modeFor(values.tone as string) });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = values.grain as number;

    const pass = new EffectPass(ctx.camera, tone, noise);

    const setOption = (key: string, value: ParamValue) => {
      values[key] = value;
      if (key === 'tone') (tone as any).mode = modeFor(value as string);
      else if (key === 'grain') noise.blendMode.opacity.value = value as number;
    };

    return {
      name: 'output',
      label: 'Output / Grade',
      schema: SCHEMA,
      toggleable: false,
      pass,
      setEnabled: () => {},
      isEnabled: () => true,
      setOption,
      getOption: (k) => values[k],
      applyMood: () => {},
      dispose: () => {
        tone.dispose();
        noise.dispose();
      },
    };
  },
};
