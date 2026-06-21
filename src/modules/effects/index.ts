/**
 * Environment FX — composable post-processing building blocks.
 *
 *   import { createEffects, selectiveBloom, godRays } from 'openkeys/effects';
 *   const fx = createEffects([selectiveBloom, godRays]);
 *   createOpenKeys(el, config, [fx.module]);   // fx.controller drives it live
 *
 * Opt-in and self-contained: the bare engine pays nothing until you compose `fx.module`.
 * `effectsPanel` is the dev experiment harness (not for production embeds).
 */
export { createEffects } from './pipeline';
export { selectiveBloom } from './selective-bloom';
export { godRays } from './god-rays';
export { output } from './output';
export { effectsPanel } from './panel';
export type {
  EffectsController,
  EffectPassFactory,
  EffectPassHandle,
  EffectContext,
  ParamSpec,
  ParamValue,
  Schema,
  PassView,
} from './types';
