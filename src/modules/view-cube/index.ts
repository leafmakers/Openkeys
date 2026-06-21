/**
 * view-cube — the navbar "gumball". The flat keycastle dot grid becomes a hollow
 * 3D cube of dots (6×6 per face, faces only — empty inside) that mirrors the
 * keyboard's live orientation and drives it back:
 *
 *  - MIRROR  : every frame it reads engine.getOrbit() and renders the cube with the
 *              exact same orthographic view basis as the main camera, so the cube
 *              shows the keyboard's apparent orientation (incl. the auto-rotate
 *              turntable and any orbiting you do).
 *  - SNAP    : click a visible face to orient the camera straight at that face
 *              (engine.setOrbit), animated; this also stops the turntable so the
 *              chosen view holds. Re-enable auto-rotate from Settings.
 *
 * Rendered to a small <canvas> with depth cueing (near dots larger/brighter) so it
 * reads as a 3D shell. Colour follows the navbar's currentColor (theme-aware).
 */
import type { OpenKeysModule } from '../../core/types';
import { tapSlop } from '../../core/utils';
import './style.css';

/** 6×6×6 lattice, surface points only → each face is a 6×6 grid (the old logo). */
const N = 6;
type P3 = [number, number, number];

function buildSurfacePoints(): P3[] {
  const pts: P3[] = [];
  const map = (v: number) => (v / (N - 1)) * 2 - 1; // 0..N-1 -> -1..1
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      for (let k = 0; k < N; k++) {
        const onSurface =
          i === 0 || i === N - 1 || j === 0 || j === N - 1 || k === 0 || k === N - 1;
        if (onSurface) pts.push([map(i), map(j), map(k)]);
      }
  return pts;
}

/** The six faces, by outward normal. Clicking one orbits the camera to look at it. */
const FACES: { n: P3 }[] = [
  { n: [1, 0, 0] },
  { n: [-1, 0, 0] },
  { n: [0, 1, 0] },
  { n: [0, -1, 0] },
  { n: [0, 0, 1] },
  { n: [0, 0, -1] },
];

const EPS = 1e-6;
/** Which axis (0/1/2) and sign a unit face-normal points along. */
const faceAxis = (n: P3): { axis: number; sign: number } => {
  for (let a = 0; a < 3; a++) if (Math.abs(n[a]) > 0.5) return { axis: a, sign: n[a] > 0 ? 1 : -1 };
  return { axis: 2, sign: 1 };
};
const pointOnFace = (p: P3, n: P3): boolean => {
  const { axis, sign } = faceAxis(n);
  return Math.abs(p[axis] - sign) < EPS;
};

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return (
    host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) ||
    host.querySelector<HTMLElement>(`#${id}`)
  );
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const viewCube: OpenKeysModule = ({ engine, host, signal }) => {
  const canvas = resolve(host, 'view-cube', 'keycastleCube') as HTMLCanvasElement | null;
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const points = buildSurfacePoints();
  // For each dot, the indices of the faces it lies on (corner/edge dots belong to
  // 2–3). A dot is drawn only when one of its faces points at the camera, so the
  // three back faces are culled and the cube reads cleanly instead of a crumbled blob.
  const pointFaces: number[][] = points.map((p) =>
    FACES.reduce<number[]>((acc, f, idx) => {
      if (pointOnFace(p, f.n)) acc.push(idx);
      return acc;
    }, [])
  );

  // Resolved dot colour (follows the navbar's currentColor → theme-aware).
  let dotColor = getComputedStyle(canvas).color || '#3c4142';
  const refreshColor = () => {
    dotColor = getComputedStyle(canvas).color || dotColor;
  };
  const offTheme = engine.on('theme', () => requestAnimationFrame(refreshColor));

  // Backing-store sizing for crisp dots on HiDPI. CSS box drives the logical size.
  // `scale` is fit to the cube's BOUNDING SPHERE — a unit cube spanning [-1,1]³ has its
  // farthest point (a corner) at √3 from centre — minus a margin for the dot radius, so
  // no dot can project outside the canvas at any rotation. That's the fix for the
  // top/bottom clipping: the old guessed factor let corners spill past the edge.
  const RADIUS_MAX = Math.sqrt(3);
  let cssSize = 40;
  let half = cssSize / 2;
  let baseR = 1; // base dot radius (CSS px), before the depth cue
  let scale = 1; // world→px projection scale (bounding-sphere fit)
  const sizeCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    cssSize = Math.max(rect.width || 40, 1);
    half = cssSize / 2;
    baseR = Math.max(0.5, cssSize * 0.025); // finer dots
    const maxDotR = baseR * 1.4 * 1.25; // depth-cue max (×1.4) × hover bump (×1.25)
    scale = (half - maxDotR - 1) / RADIUS_MAX; // +1px breathing room
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  sizeCanvas();
  const ro = new ResizeObserver(() => sizeCanvas());
  ro.observe(canvas);

  // --- View basis from the camera's (azimuth, polar). zAxis points at the camera,
  //     so we render the cube in the SAME camera space as the keyboard. ---
  type Basis = { xx: number; xy: number; xz: number; yx: number; yy: number; yz: number; zx: number; zy: number; zz: number };
  const basisFromOrbit = (az: number, polar: number): Basis => {
    const sinP = Math.sin(polar);
    const zx = sinP * Math.sin(az);
    const zy = Math.cos(polar);
    const zz = sinP * Math.cos(az);
    // xAxis = normalize(cross(up,z)) with up=(0,1,0) → (zz,0,-zx)/sinP (sinP≠0: polar is clamped).
    const xl = Math.hypot(zz, zx) || 1;
    const xx = zz / xl, xy = 0, xz = -zx / xl;
    // yAxis = cross(z,x)
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;
    return { xx, xy, xz, yx, yy, yz, zx, zy, zz };
  };
  const proj = (p: P3, b: Basis) => ({
    x: p[0] * b.xx + p[1] * b.xy + p[2] * b.xz,
    y: p[0] * b.yx + p[1] * b.yy + p[2] * b.yz,
    z: p[0] * b.zx + p[1] * b.zy + p[2] * b.zz, // +z = toward camera
  });

  // Which front-facing cube face is nearest a canvas point (CSS px from top-left).
  const pickFace = (px: number, py: number, b: Basis): P3 | null => {
    let best: P3 | null = null;
    let bestD = Infinity;
    for (const f of FACES) {
      const v = proj(f.n, b);
      if (v.z <= 0.001) continue; // back-facing
      const sx = half + v.x * scale;
      const sy = half - v.y * scale;
      const d = (sx - px) ** 2 + (sy - py) ** 2;
      if (d < bestD) { bestD = d; best = f.n; }
    }
    return best;
  };

  let hoverFace: P3 | null = null;

  // --- Snap animation state (click a face → orbit there) ---
  let snapFrom: { az: number; polar: number } | null = null;
  let snapTo: { az: number; polar: number } | null = null;
  let snapStart = 0;
  const SNAP_MS = 480;

  const startSnap = (n: P3) => {
    // Camera offset direction == face normal makes that face point at the camera.
    const targetAz = Math.atan2(n[0], n[2]);
    const targetPolar = Math.acos(Math.max(-1, Math.min(1, n[1]))); // setOrbit clamps to limits
    const cur = engine.getOrbit();
    let az = targetAz;
    while (az - cur.azimuth > Math.PI) az -= 2 * Math.PI; // shortest spin
    while (az - cur.azimuth < -Math.PI) az += 2 * Math.PI;
    engine.setCameraControls({ autoRotate: false }); // hold the snapped view
    snapFrom = { az: cur.azimuth, polar: cur.polar };
    snapTo = { az, polar: targetPolar };
    snapStart = performance.now();
  };

  const draw = () => {
    const now = performance.now();
    // Advance an in-flight snap by driving the real camera; the mirror below then
    // reads it straight back, so cube + keyboard move together.
    if (snapFrom && snapTo) {
      const t = Math.min(1, (now - snapStart) / SNAP_MS);
      const e = easeInOut(t);
      engine.setOrbit(
        snapFrom.az + (snapTo.az - snapFrom.az) * e,
        snapFrom.polar + (snapTo.polar - snapFrom.polar) * e
      );
      if (t >= 1) { snapFrom = null; snapTo = null; }
    }

    const { azimuth, polar } = engine.getOrbit();
    const b = basisFromOrbit(azimuth, polar);

    // Which of the six faces point toward the camera (+z = toward camera in view space).
    const faceFront = FACES.map((f) => proj(f.n, b).z > 1e-3);

    ctx.clearRect(0, 0, cssSize, cssSize);

    // Only dots on at least one visible face (back three faces culled); far dots first.
    const drawn = points
      .map((p, i) => ({ p, i, v: proj(p, b) }))
      .filter(({ i }) => pointFaces[i].some((f) => faceFront[f]))
      .sort((a, c) => a.v.z - c.v.z);

    for (const { p, v } of drawn) {
      const t = (v.z + 1.8) / 3.6; // depth 0..1 (far..near)
      const sx = half + v.x * scale;
      const sy = half - v.y * scale;
      const onHover = hoverFace ? pointOnFace(p, hoverFace) : false;
      const r = baseR * (0.6 + 0.8 * t) * (onHover ? 1.25 : 1);
      let alpha = 0.32 + 0.68 * t;
      if (onHover) alpha = Math.min(1, alpha + 0.25);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  let raf = requestAnimationFrame(function loop() {
    raf = requestAnimationFrame(loop);
    draw();
  });

  // --- Pointer interaction ---
  // On touch the gumball is a passive live mirror: per-face targets are sub-44px on a
  // ~40px canvas, so blind face-tapping would be a guessing game. It still renders and
  // mirrors the keyboard; snapping/hover are mouse-only. Desktop keeps click-to-snap.
  const localXY = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  let downX = 0;
  let downY = 0;
  const onDown = (e: PointerEvent) => {
    const p = localXY(e);
    downX = p.x;
    downY = p.y;
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // hover is a mouse affordance
    const { x, y } = localXY(e);
    const { azimuth, polar } = engine.getOrbit();
    hoverFace = pickFace(x, y, basisFromOrbit(azimuth, polar));
    canvas.style.cursor = hoverFace ? 'pointer' : 'default';
  };
  const onLeave = () => { hoverFace = null; canvas.style.cursor = 'default'; };
  const onClick = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // passive on touch (see note above)
    const { x, y } = localXY(e);
    if (Math.hypot(x - downX, y - downY) > tapSlop(e.pointerType)) return; // a drag-off, not a tap
    const { azimuth, polar } = engine.getOrbit();
    const face = pickFace(x, y, basisFromOrbit(azimuth, polar));
    if (face) startSnap(face);
  };
  canvas.addEventListener('pointerdown', onDown, { signal });
  canvas.addEventListener('pointermove', onMove, { signal });
  canvas.addEventListener('pointerleave', onLeave, { signal });
  canvas.addEventListener('pointerup', onClick, { signal });

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    offTheme();
  };
};
