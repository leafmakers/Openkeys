/**
 * view-toggles — three quick navbar buttons for the 3D view:
 *   • auto-rotate  — the turntable spins on its own (camera.controls.autoRotate)
 *   • turntable    — drag-to-orbit on/off            (camera.controls.enableRotate)
 *   • projection   — perspective ⇆ parallel/ortho    (camera.projection)
 *
 * Each reflects live state (.active + aria-pressed) and stays in sync with the
 * settings panel via the engine's `config` event. No new engine API — uses the
 * existing setCameraControls / setProjection (both emit `config`).
 */
import type { OpenKeysModule } from '../../core/types';
import './style.css';

function resolve(host: HTMLElement, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`#${id}`);
}

export const viewToggles: OpenKeysModule = ({ engine, host, signal }) => {
  const autoBtn = resolve(host, 'autoRotateToggle');
  const turntableBtn = resolve(host, 'turntableToggle');
  const projBtn = resolve(host, 'projectionToggle');
  if (!autoBtn && !turntableBtn && !projBtn) return () => {};

  const setState = (btn: HTMLElement | null, on: boolean) => {
    if (!btn) return;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  };

  /** Mirror the live config into the three buttons. */
  const sync = () => {
    const c = engine.config.camera.controls;
    setState(autoBtn, c.autoRotate);
    setState(turntableBtn, c.enableRotate);
    const perspective = engine.config.camera.projection === 'perspective';
    setState(projBtn, perspective);
    if (projBtn) {
      projBtn.title = perspective
        ? 'Perspective — click for parallel (orthographic)'
        : 'Parallel (orthographic) — click for perspective';
    }
  };

  autoBtn?.addEventListener(
    'click',
    () => engine.setCameraControls({ autoRotate: !engine.config.camera.controls.autoRotate }),
    { signal }
  );
  turntableBtn?.addEventListener(
    'click',
    () => engine.setCameraControls({ enableRotate: !engine.config.camera.controls.enableRotate }),
    { signal }
  );
  projBtn?.addEventListener(
    'click',
    () =>
      engine.setProjection(
        engine.config.camera.projection === 'perspective' ? 'orthographic' : 'perspective'
      ),
    { signal }
  );

  const off = engine.on('config', sync);
  sync();
  return () => off();
};
