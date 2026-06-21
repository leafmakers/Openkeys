import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Scene } from './scene';
import type { OpenKeysConfig, ThemeColors, Cell, KeyDef, LabelAnchor } from './config';
import type { Emitter } from './emitter';
import type { OpenKeysEvents } from './types';

type Emit = Emitter<OpenKeysEvents>['emit'];
const noopEmit: Emit = () => {};

/** Normalize a layout cell (plain string or rich descriptor) to a full KeyDef. */
function normalizeCell(cell: Cell): Required<KeyDef> {
  if (typeof cell === 'string') {
    return { id: cell, label: cell, w: 1, typeable: true };
  }
  return {
    id: cell.id,
    label: cell.label,
    w: cell.w ?? 1,
    typeable: cell.typeable ?? true,
  };
}

export class Keyboard {
  private scene: Scene;
  private config: OpenKeysConfig;
  private emit: Emit;
  private rowStagger: number;
  private keyGap: number;
  private originX: number;
  private originZ: number;
  private keyMap: Cell[][];
  /** Cap label per key id (id may differ from label for modifiers/duplicates). */
  private keyLabels: Record<string, string>;
  /** Opacity for structural (non-typeable) keys; 1 = no fade. */
  private structuralKeyOpacity: number;
  /** Resting height for structural (non-typeable) keys; 0 = flat. */
  private structuralKeyHeight: number;
  /** Resting/starting height baseline for the data (main 36) keys. */
  private mainKeyHeight: number;
  /** Ids of structural keys (typeable:false) — the non-data keys to fade. */
  private structuralKeys: Set<string>;
  /** Keys whose height is being driven by a transient animation (skip idle reapply). */
  private animatingKeys: Set<string> = new Set();
  /** Reused ray for click-picking keys. */
  private raycaster = new THREE.Raycaster();
  /** Opacity multipliers per visual channel for the data (main 36) keys (1 = natural). */
  private faceOpacity: number;
  private wallOpacity: number;
  private outlineOpacity: number;
  private textOpacity: number;
  /** Opacity multipliers per visual channel for the structural (extra) keys. */
  private extraFaceOpacity: number;
  private extraWallOpacity: number;
  private extraOutlineOpacity: number;
  private extraTextOpacity: number;
  /** Currently hover-highlighted key id, and a closure that undoes the accent. */
  private highlightedKeyId: string | null = null;
  private highlightRestore: (() => void) | null = null;
  /** Frame around the whole board, and the footprint it's offset from. The flat
   *  stroke (boundaryObject) shows at height 0; boundaryFrame is the extruded 3D rim. */
  private boundaryObject: THREE.LineLoop | null = null;
  private boundaryFrame: THREE.Mesh | null = null;
  private footprint: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;
  private keyObjects: Record<string, THREE.Mesh>;
  private textObjects: Record<string, THREE.Mesh>;
  private outlineObjects: Record<string, THREE.LineSegments>;
  private baseOutlineObjects: Record<string, THREE.LineSegments>;
  private keyHeights: Record<string, number>;
  private keyWaves: Record<string, { time: number; active: boolean; distance?: number }>;
  private keyTypeCounts: Record<string, number>;
  private keySize: number;
  private spacing: number;
  private growthIncrement: number;
  /** Composition ceiling: the growth portion of the tallest data key is auto-scaled
   *  so it never exceeds this. 0 = uncapped (classic linear growth). */
  private maxKeyHeight: number;
  /** Cached highest data-key value, for the proportional height auto-scale. */
  private maxDataValue: number = 0;
  private waveSpeed: number;
  private waveRadius: number;
  private waveHeight: number;
  private idleAnimationTime: number;
  private clearAnimationInProgress: boolean = false;
  /** True once the (async font-dependent) keyboard mesh has been built. */
  public isBuilt: boolean = false;
  private onReadyCallback: (() => void) | null = null;
  private container: THREE.Group;
  private isDarkMode: boolean;
  private keyMaterials: Record<string, THREE.MeshPhysicalMaterial[]>;
  private textMaterials: Record<string, THREE.MeshPhysicalMaterial>;
  private loadedFonts: Record<string, any>;
  private currentFont: any;
  private fontLoader: FontLoader;
  private rotationState: {
    isRotating: boolean;
    startTime: number;
    rotationDuration: number;
    pauseDuration: number;
    initialRotation: number;
    targetRotation: number;
    isPaused: boolean;
    pauseStartTime: number;
  };
  // Animation state removed - was unused
  // private aiRemixAnimation: {
  //   isActive: boolean;
  //   startTime: number;
  //   pulseSpeed: number;
  //   waveRadius: number;
  // };

  constructor(scene: Scene, config: OpenKeysConfig, emit: Emit = noopEmit) {
    this.scene = scene;
    this.config = config;
    this.emit = emit;

    // Keyboard layout comes from config (QWERTY by default)
    this.keyMap = config.layout.rows;
    this.rowStagger = config.layout.rowStagger;
    this.keyGap = config.layout.keyGap;
    // Board placement. Defaults reproduce the classic hardcoded offsets; wide
    // layouts (e.g. 'full') override these to re-centre the larger footprint.
    this.originX = config.layout.originX ?? -50;
    this.originZ = config.layout.originZ ?? -20;
    this.structuralKeyOpacity = config.layout.structuralKeyOpacity ?? 1;
    this.structuralKeyHeight = config.layout.structuralKeyHeight ?? 0;
    this.mainKeyHeight = config.layout.mainKeyHeight ?? 0;
    this.faceOpacity = config.appearance.faceOpacity ?? 1;
    this.wallOpacity = config.appearance.wallOpacity ?? 1;
    this.outlineOpacity = config.appearance.outlineOpacity ?? 1;
    this.textOpacity = config.appearance.textOpacity ?? 1;
    this.extraFaceOpacity = config.appearance.extraFaceOpacity ?? 1;
    this.extraWallOpacity = config.appearance.extraWallOpacity ?? 1;
    this.extraOutlineOpacity = config.appearance.extraOutlineOpacity ?? 1;
    this.extraTextOpacity = config.appearance.extraTextOpacity ?? 1;

    // Initialize properties
    // Key-related objects and states
    this.keyLabels = {};
    this.structuralKeys = new Set();
    this.keyObjects = {};
    this.textObjects = {};
    this.outlineObjects = {};
    this.baseOutlineObjects = {};
    this.keyHeights = {};
    this.keyWaves = {};
    this.keyTypeCounts = {};
    this.keyMaterials = {};
    this.textMaterials = {};
    this.loadedFonts = {};
    this.currentFont = null;
    this.fontLoader = new FontLoader();

    // Keyboard dimensions and animation parameters (from config)
    this.keySize = config.layout.keySize;
    this.spacing = config.layout.spacing;
    this.growthIncrement = config.data.growthIncrement;
    this.maxKeyHeight = config.data.maxKeyHeight ?? 0;
    this.waveSpeed = config.animation.wave.speed;
    this.waveRadius = config.animation.wave.radius;
    this.waveHeight = config.animation.wave.height;
    this.idleAnimationTime = 0;

    // State flags
    this.isDarkMode = config.theme.mode === 'dark';
    // Animation state removed - was unused

    // Setup keyboard container
    // Create a container for all keyboard elements
    this.container = new THREE.Group();
    this.scene.scene.add(this.container);
    
    // Initialize rotation animation properties
    this.rotationState = {
      isRotating: config.animation.intro.enabled,
      startTime: performance.now(),
      rotationDuration: config.animation.intro.duration,
      pauseDuration: config.animation.intro.pause,
      initialRotation: 0,
      targetRotation: Math.PI * 2, // 360 degrees
      isPaused: false,
      pauseStartTime: 0
    };

    this.loadFonts();
  }

  private theme(): ThemeColors {
    return this.isDarkMode ? this.config.theme.dark : this.config.theme.light;
  }

  createKeyMaterial() {
    const colors = this.theme();

    // Simple side material without complex textures
    const sideMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colors.keySide),
      transparent: true,
      opacity: 0.8
    });

    // Top material - physical material for light mode, basic for dark mode
    const topMaterial = this.isDarkMode
      ? new THREE.MeshBasicMaterial({
          color: new THREE.Color(colors.keyTop),
          transparent: false
        })
      : new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(colors.keyTop),
          metalness: 0.1,
          roughness: 0.2,
          clearcoat: 0.8,
          clearcoatRoughness: 0.1,
          emissive: new THREE.Color(colors.keyTop),
          emissiveIntensity: 0.3,
          transparent: false
        });

    // Cast from the same visible surfaces the viewer sees. Three.js otherwise
    // defaults to the opposite side for shadow rendering, which is useful for
    // acne avoidance but visibly detaches low-profile keys from the floor.
    sideMaterial.shadowSide = THREE.FrontSide;
    topMaterial.shadowSide = THREE.FrontSide;

    // Push the FACES slightly back in the depth buffer (polygonOffset is polygon-only;
    // it never touches the engraved-letter or edge geometry). The engraved label sits a
    // hair above its cap and the edge outline (LineSegments) is exactly coplanar with
    // the box edges — at this viewing distance both share the cap's depth and shimmer.
    // Receding the faces by a constant offset lets the letters + edge lines reliably win
    // the depth test against their own key, with no visible separation, at every key
    // height and in both projections. It's a uniform shift, so inter-key ordering and
    // shadows are unaffected.
    for (const m of [sideMaterial, topMaterial]) {
      m.polygonOffset = true;
      m.polygonOffsetFactor = 1;
      m.polygonOffsetUnits = 1;
    }

    return [
      sideMaterial, sideMaterial, topMaterial,
      sideMaterial, sideMaterial, sideMaterial
    ];
  }

  loadFonts() {
    // Key-cap typefaces come from config (three.js typeface.json)
    const fonts = this.config.typography.keyCapFonts;
    const defaultName = this.config.typography.defaultFont;

    let fontsLoaded = 0;
    const totalFonts = fonts.length;

    fonts.forEach(({ name: fontName, url }) => {
      this.fontLoader.load(url, (font) => {
        this.loadedFonts[fontName] = font;
        fontsLoaded++;

        // Use the configured default font
        if (fontName === defaultName) {
          this.currentFont = font;
        }

        // Create keyboard when all fonts are loaded
        if (fontsLoaded === totalFonts) {
          // Fall back to the first loaded font if the default name didn't match
          if (!this.currentFont) {
            this.currentFont = this.loadedFonts[fonts[0].name];
          }
          this.createKeyboard();
        }
      });
    });
  }

  createKeyboard() {
    this.keyMap.forEach((row, rowIndex) => {
      const z = this.originZ + rowIndex * this.spacing;
      // Cursor tracks the left edge of the next key, advancing by each key's
      // actual width so variable-width keys (space bar, modifiers) line up and
      // every row ends flush — producing the rectangular silhouette.
      let cursor = this.originX + rowIndex * this.rowStagger;

      row.forEach((cell) => {
        const def = normalizeCell(cell);
        const widthPx = def.w * this.keySize + (def.w - 1) * this.keyGap;
        const centerX = cursor + widthPx / 2;
        this.createKeyWithOutlineAndText(def, centerX, z, widthPx, this.currentFont);
        cursor += widthPx + this.keyGap;
      });
    });

    this.applyOpacities();
    this.computeFootprint();
    this.createBoundary();
    this.isBuilt = true;
    this.onReadyCallback?.();
  }

  /** Bounding extents of all key footprints (container-local), for the boundary. */
  private computeFootprint() {
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const m of Object.values(this.keyObjects)) {
      const g = m.geometry as THREE.BoxGeometry;
      const w = g.parameters?.width ?? this.keySize;
      const d = g.parameters?.depth ?? this.keySize;
      minX = Math.min(minX, m.position.x - w / 2);
      maxX = Math.max(maxX, m.position.x + w / 2);
      minZ = Math.min(minZ, m.position.z - d / 2);
      maxZ = Math.max(maxZ, m.position.z + d / 2);
    }
    this.footprint = Number.isFinite(minX) ? { minX, maxX, minZ, maxZ } : null;
  }

  /** Build the boundary objects once (flat stroke + 3D frame), then size them. */
  private createBoundary() {
    if (this.boundaryObject) return;
    const op = this.config.scene.boundary.opacity;
    // Flat stroke — shown when height is 0.
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.theme().outline),
      transparent: true,
      opacity: op,
    });
    this.boundaryObject = new THREE.LineLoop(new THREE.BufferGeometry(), lineMat);
    this.boundaryObject.position.y = 0.1; // just above the floor, like the base outlines
    this.container.add(this.boundaryObject);

    // 3D rim — an extruded rounded-rect band, shown when height > 0. Lit (Standard)
    // so its faces shade and it reads as a solid frame in both light and dark themes.
    const frameMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.theme().outline),
      roughness: 0.55,
      metalness: 0.0,
      transparent: op < 1,
      opacity: op,
      depthWrite: op >= 1,
    });
    this.boundaryFrame = new THREE.Mesh(new THREE.BufferGeometry(), frameMat);
    this.boundaryFrame.position.y = 0.01; // base flush with the floor / key bases
    this.container.add(this.boundaryFrame);

    this.rebuildBoundary();
  }

  /** Trace a centered rounded rectangle into a Shape or Path (XY plane). */
  private static roundedRectPath(ctx: THREE.Shape | THREE.Path, hw: number, hd: number, rad: number) {
    const k = Math.max(0, Math.min(rad, hw, hd));
    ctx.moveTo(-hw + k, -hd);
    ctx.lineTo(hw - k, -hd);
    if (k > 0) ctx.absarc(hw - k, -hd + k, k, -Math.PI / 2, 0, false);
    ctx.lineTo(hw, hd - k);
    if (k > 0) ctx.absarc(hw - k, hd - k, k, 0, Math.PI / 2, false);
    ctx.lineTo(-hw + k, hd);
    if (k > 0) ctx.absarc(-hw + k, hd - k, k, Math.PI / 2, Math.PI, false);
    ctx.lineTo(-hw, -hd + k);
    if (k > 0) ctx.absarc(-hw + k, -hd + k, k, Math.PI, Math.PI * 1.5, false);
    ctx.closePath();
  }

  /** Recompute boundary geometry + visibility from config + footprint. Shows the
   *  flat stroke when height is 0, otherwise the extruded 3D frame. */
  private rebuildBoundary() {
    if (!this.boundaryObject || !this.footprint) return;
    const b = this.config.scene.boundary;
    const hw = (this.footprint.maxX - this.footprint.minX) / 2 + b.gap;
    const hd = (this.footprint.maxZ - this.footprint.minZ) / 2 + b.gap;
    const r = Math.max(0, Math.min(b.radius, hw, hd));
    const cx = (this.footprint.minX + this.footprint.maxX) / 2;
    const cz = (this.footprint.minZ + this.footprint.maxZ) / 2;
    const is3D = b.enabled && b.height > 0 && b.thickness > 0;

    // --- Flat stroke (rounded-rect line loop) ---
    this.boundaryObject.visible = b.enabled && !is3D;
    const seg = 10; // points per rounded corner
    const corners = [
      { cu: hw - r, cv: hd - r, a0: 0 },
      { cu: -(hw - r), cv: hd - r, a0: Math.PI / 2 },
      { cu: -(hw - r), cv: -(hd - r), a0: Math.PI },
      { cu: hw - r, cv: -(hd - r), a0: (3 * Math.PI) / 2 },
    ];
    const pts: THREE.Vector3[] = [];
    for (const c of corners) {
      for (let i = 0; i <= seg; i++) {
        const a = c.a0 + (i / seg) * (Math.PI / 2);
        pts.push(new THREE.Vector3(c.cu + r * Math.cos(a), 0, c.cv + r * Math.sin(a)));
      }
    }
    this.boundaryObject.geometry.dispose();
    this.boundaryObject.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.boundaryObject.position.x = cx;
    this.boundaryObject.position.z = cz;

    // --- 3D frame (extruded rounded-rect ring) ---
    if (this.boundaryFrame) {
      this.boundaryFrame.visible = is3D;
      if (is3D) {
        const t = Math.min(b.thickness, hw - 0.01, hd - 0.01);
        const shape = new THREE.Shape();
        Keyboard.roundedRectPath(shape, hw, hd, r);
        const hole = new THREE.Path();
        Keyboard.roundedRectPath(hole, Math.max(0.01, hw - t), Math.max(0.01, hd - t), Math.max(0, r - t));
        shape.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: b.height,
          bevelEnabled: false,
          curveSegments: 8,
        });
        geo.rotateX(-Math.PI / 2); // shape lies on the floor; extrude rises +Y
        this.boundaryFrame.geometry.dispose();
        this.boundaryFrame.geometry = geo;
        this.boundaryFrame.position.x = cx;
        this.boundaryFrame.position.z = cz;
      }
    }
  }

  /** Live-apply boundary config (enabled / gap / radius / opacity / height / thickness). */
  updateBoundary() {
    const op = this.config.scene.boundary.opacity;
    const outline = this.theme().outline;
    if (this.boundaryObject) {
      const m = this.boundaryObject.material as THREE.LineBasicMaterial;
      m.color.set(outline);
      m.opacity = op;
    }
    if (this.boundaryFrame) {
      const m = this.boundaryFrame.material as THREE.MeshStandardMaterial;
      m.color.set(outline);
      m.opacity = op;
      m.transparent = op < 1;
      m.depthWrite = op >= 1;
      m.needsUpdate = true;
    }
    this.rebuildBoundary();
  }

  /** Register a callback to run once the keyboard mesh is built (fires immediately if already built). */
  setOnReady(cb: () => void) {
    this.onReadyCallback = cb;
    if (this.isBuilt) cb();
  }

  createKeyWithOutlineAndText(def: Required<KeyDef>, centerX: number, centerZ: number, widthPx: number, font: any) {
    const { id, label } = def;

    // Create main key mesh
    const geometry = new THREE.BoxGeometry(widthPx, this.keySize, this.keySize);
    const keyMaterials = this.createKeyMaterial();
    const mesh = new THREE.Mesh(geometry, keyMaterials);
    mesh.userData.keyId = id; // for click/raycast picking
    this.setupKeyMesh(mesh, centerX, centerZ);

    // Create key outline
    const outline = this.createKeyOutline(mesh);

    // Create base outline
    const baseOutline = this.createBaseOutline(mesh.position, widthPx);

    // Create text material for this key
    const textMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.theme().keyText),
      metalness: 0,
      roughness: 1
    });

    // Create key text
    const textMesh = this.createKeyText(label, font, textMaterial);
    mesh.add(textMesh);

    // Store references (keyed by unique id; data keys use the character as id)
    this.keyLabels[id] = label;
    this.keyObjects[id] = mesh;
    this.keyMaterials[id] = keyMaterials as THREE.MeshPhysicalMaterial[];
    this.textMaterials[id] = textMaterial;
    this.outlineObjects[id] = outline;
    this.baseOutlineObjects[id] = baseOutline;
    this.textObjects[id] = textMesh;
    this.keyHeights[id] = 0;
    this.keyWaves[id] = { time: 0, active: false };
    this.keyTypeCounts[id] = 0;
    if (!def.typeable) this.structuralKeys.add(id);
  }

  /** Live-set the structural-key opacity (e.g. from the settings slider). */
  setStructuralKeyOpacity(opacity: number) {
    this.structuralKeyOpacity = Math.max(0, Math.min(1, opacity));
    this.applyOpacities();
  }

  /** Live-set the structural-key resting height. The per-frame idle pass re-applies it. */
  setStructuralKeyHeight(height: number) {
    this.structuralKeyHeight = Math.max(0, height);
  }

  /** Live-set the data (main 36) key starting/resting height. */
  setMainKeyHeight(height: number) {
    this.mainKeyHeight = Math.max(0, height);
  }

  /** Live-set the base rise per tap (height per occurrence before auto-scaling). */
  setRisePerTap(rise: number) {
    this.growthIncrement = Math.max(0, rise);
  }

  /** Live-set the composition ceiling (max growth height; 0 = uncapped). */
  setMaxKeyHeight(height: number) {
    this.maxKeyHeight = Math.max(0, height);
  }

  /**
   * Effective rise per tap. Normally the configured `growthIncrement`, but once the
   * busiest key would push past `maxKeyHeight` it's scaled down proportionally so the
   * tallest key sits exactly at the ceiling — like the headline that shrinks to fit.
   * Short/sparse text is unaffected; long repetitive text compresses gracefully.
   */
  private effectivePerTap(): number {
    if (this.maxKeyHeight > 0 && this.maxDataValue > 0) {
      return Math.min(this.growthIncrement, this.maxKeyHeight / this.maxDataValue);
    }
    return this.growthIncrement;
  }

  /** Recompute the cached highest data-key value (drives the height auto-scale). */
  private recomputeMaxValue(): void {
    let max = 0;
    for (const id in this.keyTypeCounts) {
      if (this.structuralKeys.has(id)) continue;
      const v = this.keyTypeCounts[id] || 0;
      if (v > max) max = v;
    }
    this.maxDataValue = max;
  }

  /** Resting height for a key: structural keys sit at structuralKeyHeight; data
   *  keys rest at mainKeyHeight and rise from there by their (auto-scaled) value. */
  private baseHeightFor(key: string): number {
    return this.structuralKeys.has(key)
      ? this.structuralKeyHeight
      : this.mainKeyHeight + this.effectivePerTap() * (this.keyTypeCounts[key] || 0);
  }

  /** Live-set the data (main 36) key top-face opacity multiplier (0–1). */
  setFaceOpacity(opacity: number) {
    this.faceOpacity = Math.max(0, Math.min(1, opacity));
    this.applyOpacities();
  }

  /** Live-set the data (main 36) key side-wall opacity multiplier (0–1). */
  setWallOpacity(opacity: number) {
    this.wallOpacity = Math.max(0, Math.min(1, opacity));
    this.applyOpacities();
  }

  /** Live-set the data-key outline opacity multiplier (0–1). */
  setOutlineOpacity(opacity: number) {
    this.outlineOpacity = Math.max(0, Math.min(1, opacity));
    this.applyOpacities();
  }

  /** Live-set the data-key label opacity multiplier (0–1). */
  setTextOpacity(opacity: number) {
    this.textOpacity = Math.max(0, Math.min(1, opacity));
    this.applyOpacities();
  }

  /** Live-set the structural (extra) key top-face opacity multiplier (0–1). */
  setExtraFaceOpacity(opacity: number) {
    this.extraFaceOpacity = Math.max(0, Math.min(1, opacity));
    this.applyOpacities();
  }

  /** Live-set the structural (extra) key side-wall opacity multiplier (0–1). */
  setExtraWallOpacity(opacity: number) {
    this.extraWallOpacity = Math.max(0, Math.min(1, opacity));
    this.applyOpacities();
  }

  /** Live-set the structural-key outline opacity multiplier (0–1). */
  setExtraOutlineOpacity(opacity: number) {
    this.extraOutlineOpacity = Math.max(0, Math.min(1, opacity));
    this.applyOpacities();
  }

  /** Live-set the structural-key label opacity multiplier (0–1). */
  setExtraTextOpacity(opacity: number) {
    this.extraTextOpacity = Math.max(0, Math.min(1, opacity));
    this.applyOpacities();
  }

  /**
   * Hover spotlight: tint a single key toward `color` (a CSS color string, e.g. the
   * frequency-bar segment's fill). Subtle and fully reversible — it snapshots the
   * exact material values it touches and restores them in clearHighlight(), so it
   * composes with the theme/opacity systems without disturbing them. Only one key
   * is highlighted at a time; passing an unknown label just clears.
   */
  highlightKey(label: string, color: string) {
    const id = label;
    const mats = this.keyMaterials[id];
    if (this.highlightedKeyId === id) return; // already lit
    this.clearHighlight();
    if (!this.keyObjects[id] || !mats) return;

    const accent = new THREE.Color(color);
    const top = mats[2] as any; // top cap (physical in light, basic in dark)
    const side = mats[0] as any; // shared side material for this key
    const outline = this.outlineObjects[id]?.material as THREE.LineBasicMaterial | undefined;
    const base = this.baseOutlineObjects[id]?.material as THREE.LineBasicMaterial | undefined;

    // Snapshot exactly what we mutate.
    const oTop = top.color.clone();
    const oSide = side.color.clone();
    const oEmissive = top.emissive ? top.emissive.clone() : null;
    const oEmissiveInt = top.emissive ? top.emissiveIntensity : 0;
    const oOutlineColor = outline?.color.clone();
    const oOutlineOpacity = outline?.opacity ?? 0;
    const oBaseColor = base?.color.clone();
    const oBaseOpacity = base?.opacity ?? 0;

    // Apply a gentle accent: tint faces, light up the edges, add a soft glow.
    top.color.lerp(accent, 0.35);
    side.color.lerp(accent, 0.22);
    top.needsUpdate = true;
    side.needsUpdate = true;
    if (top.emissive) {
      top.emissive.copy(accent);
      top.emissiveIntensity = 0.55;
    }
    if (outline) {
      outline.color.copy(accent);
      outline.opacity = Math.max(oOutlineOpacity, 0.95);
      outline.needsUpdate = true;
    }
    if (base) {
      base.color.copy(accent);
      base.opacity = Math.max(oBaseOpacity, 0.9);
      base.needsUpdate = true;
    }

    this.highlightRestore = () => {
      top.color.copy(oTop);
      side.color.copy(oSide);
      if (top.emissive && oEmissive) {
        top.emissive.copy(oEmissive);
        top.emissiveIntensity = oEmissiveInt;
      }
      top.needsUpdate = true;
      side.needsUpdate = true;
      if (outline && oOutlineColor) {
        outline.color.copy(oOutlineColor);
        outline.opacity = oOutlineOpacity;
        outline.needsUpdate = true;
      }
      if (base && oBaseColor) {
        base.color.copy(oBaseColor);
        base.opacity = oBaseOpacity;
        base.needsUpdate = true;
      }
    };
    this.highlightedKeyId = id;
  }

  /** Remove the hover spotlight, restoring the key's exact prior materials. */
  clearHighlight() {
    this.highlightRestore?.();
    this.highlightRestore = null;
    this.highlightedKeyId = null;
  }

  /**
   * Apply opacity to every key's three channels (faces, outlines, label).
   * Final opacity = naturalOpacity × channelMultiplier × structuralFade, where
   * the channel multiplier is the data-key set for the 36 and the *extra* set for
   * structural keys, and the structural fade only bites on non-data keys (and
   * only when `structuralKeyOpacity < 1`). Fully two-way — at all-1 it restores
   * each material to its natural state — so it backs the live sliders. Idempotent
   * and re-run after theme/font rebuilds (which recreate some of these materials).
   */
  private applyOpacities() {
    const o = this.structuralKeyOpacity;
    const colors = this.theme();
    Object.keys(this.keyObjects).forEach((id) => {
      const isExtra = this.structuralKeys.has(id);
      // A structural (non-data) key fades to `o`; a data key keeps its natural base.
      const faded = isExtra && o < 1;
      // Channel multipliers come from the key's group (main vs extra). The top cap
      // and the side walls are independently controllable.
      const faceMul = isExtra ? this.extraFaceOpacity : this.faceOpacity;
      const wallMul = isExtra ? this.extraWallOpacity : this.wallOpacity;
      const outlineMul = isExtra ? this.extraOutlineOpacity : this.outlineOpacity;
      const textMul = isExtra ? this.extraTextOpacity : this.textOpacity;

      // BoxGeometry material groups: index 2 is the top cap (naturally opaque); the
      // rest are side walls (naturally 0.8, transparent). createKeyMaterial sets these.
      this.keyMaterials[id]?.forEach((m, i) => {
        const isTop = i === 2;
        const natural = isTop ? 1 : 0.8;
        const op = (faded ? o : natural) * (isTop ? faceMul : wallMul);
        m.opacity = op;
        m.transparent = op < 1;
        m.needsUpdate = true;
      });
      // Edge outline: natural opacity is the current theme's outline opacity.
      const outline = this.outlineObjects[id]?.material as THREE.LineBasicMaterial | undefined;
      if (outline) {
        outline.opacity = (faded ? o : colors.outlineOpacity) * outlineMul;
        outline.transparent = true;
        outline.needsUpdate = true;
      }
      const base = this.baseOutlineObjects[id]?.material as THREE.LineBasicMaterial | undefined;
      if (base) {
        base.opacity = (faded ? o : colors.baseOutlineOpacity) * outlineMul;
        base.transparent = true;
        base.needsUpdate = true;
      }
      // Engraved label: naturally opaque.
      const text = this.textMaterials[id];
      if (text) {
        const op = (faded ? o : 1) * textMul;
        text.opacity = op;
        text.transparent = op < 1;
        text.needsUpdate = true;
      }
    });
  }

  setupKeyMesh(mesh: THREE.Mesh, centerX: number, centerZ: number) {
    mesh.position.set(centerX, 0, centerZ);
    mesh.scale.y = 0.01;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.container.add(mesh);
  }

  createKeyOutline(mesh: THREE.Mesh) {
    // Derive edges from the key's actual geometry. A separately inflated box used
    // to create a visible outline/face offset that became pronounced when zoomed.
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const colors = this.theme();

    // Create material that responds to dark mode
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(colors.outline),
      linewidth: 3,
      transparent: true,
      opacity: colors.outlineOpacity,
      depthTest: true,
      depthWrite: false,
    });

    const outline = new THREE.LineSegments(edges, outlineMaterial);
    outline.position.copy(mesh.position);
    outline.scale.y = 0.01;
    // Draw after the face. Equal-depth edge fragments pass while lines behind
    // another key remain occluded by that key's depth buffer.
    outline.renderOrder = 2;
    outline.castShadow = false;
    this.container.add(outline);
    return outline;
  }

  createBaseOutline(position: THREE.Vector3, widthPx: number = this.keySize) {
    // Rectangular outline tracing the exact key footprint on the floor.
    const baseGeometry = new THREE.PlaneGeometry(widthPx, this.keySize);
    const edges = new THREE.EdgesGeometry(baseGeometry);
    const colors = this.theme();

    // Match the key edge outline so the base reads like the other edges.
    const baseOutlineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(colors.baseOutline),
      linewidth: 3,
      transparent: true,
      opacity: colors.baseOutlineOpacity,
      depthTest: true,
      depthWrite: false,
    });
    
    const baseOutline = new THREE.LineSegments(edges, baseOutlineMaterial);
    baseOutline.position.copy(position);
    baseOutline.position.y = 0.01; // Clear the floor without floating into key walls
    baseOutline.rotation.x = -Math.PI / 2; // Lay flat on the ground
    // Render after transparent key walls so their depth occludes footprint lines
    // instead of letting those lines bleed through the faces.
    baseOutline.renderOrder = 1;
    this.container.add(baseOutline);
    return baseOutline;
  }

  createKeyText(label: string, font: any, material: THREE.MeshPhysicalMaterial) {
    // Blank caps (e.g. the space bar) get an empty, geometry-less mesh so the
    // font-rebuild path and dictionaries stay uniform across all keys.
    let geometry: THREE.BufferGeometry = new THREE.BufferGeometry();
    if (label && label.trim()) {
      // Multi-character labels (modifiers like "shift"/"return") use a smaller
      // size so they fit on the cap.
      const size =
        label.length > 1 ? this.config.typography.textSize * 0.72 : this.config.typography.textSize;
      // labelWeight > 1 fattens the strokes via an in-plane bevel (the keycap fonts
      // ship a single weight). bevelThickness stays tiny so it doesn't add Y-depth
      // that would stretch as a key grows; bevelSize widens the strokes on the cap.
      const weight = this.config.typography.labelWeight ?? 1;
      const bevelSize = weight > 1 ? (weight - 1) * 0.45 * (size / 2.5) : 0;
      try {
        const textGeometry = new TextGeometry(label, {
          font: font,
          size,
          height: 0,
          curveSegments: this.config.typography.curveSegments,
          bevelEnabled: bevelSize > 0,
          bevelThickness: bevelSize > 0 ? 0.02 : 0,
          bevelSize,
          bevelSegments: 2,
        });
        textGeometry.computeBoundingBox();
        geometry = textGeometry;
      } catch {
        // Glyph missing from this font — leave the cap blank rather than crash.
        geometry = new THREE.BufferGeometry();
      }
    }

    const textMesh = new THREE.Mesh(geometry, material);
    // Lay the glyph flat on the cap. Rotation -π/2 maps glyph local +Y → world −Z,
    // so the glyph's height becomes its Z (depth) extent on the cap top.
    textMesh.rotation.x = -Math.PI / 2;

    const bb = geometry.boundingBox;
    const minX = bb ? bb.min.x : 0;
    const maxX = bb ? bb.max.x : 0;
    const minY = bb ? bb.min.y : 0;
    const maxY = bb ? bb.max.y : 0;
    const td = maxY - minY; // glyph height → world-Z extent after the rotation
    const cy = (minY + maxY) / 2;
    const half = this.keySize / 2;
    const inset = this.keySize * 0.16; // margin from the cap edge

    // Anchor the label on the cap top (3×3 grid). Default 'center' is truly centered.
    // X = along the row; Z = depth (top = away from camera/−Z, bottom = toward/+Z).
    const anchor = this.config.typography.labelAnchor ?? 'center';
    let posX: number;
    if (anchor.includes('left')) posX = -half + inset - minX;
    else if (anchor.includes('right')) posX = half - inset - maxX;
    else posX = -(minX + maxX) / 2;

    let zc: number; // target glyph z-centre
    if (anchor.includes('top')) zc = -half + inset + td / 2;
    else if (anchor.includes('bottom')) zc = half - inset - td / 2;
    else zc = 0;
    const posZ = zc + cy; // world z = position.z − localY, so offset by the glyph's y-centre

    textMesh.position.set(posX, this.keySize / 2 + 0.1, posZ);
    return textMesh;
  }

  updateKeyObject(key: string, targetHeight: number | null = null) {
    const mesh = this.keyObjects[key];
    const outline = this.outlineObjects[key];
    
    // CRITICAL: Height must ALWAYS match character count - never override this relationship
    const height = this.keyHeights[key] || 0.01;
    
    // Only allow temporary height override for animations (like key press effects)
    const displayHeight = targetHeight !== null ? targetHeight : height;
    
    mesh.scale.y = Math.max(0.01, displayHeight);
    mesh.position.y = (this.keySize * displayHeight) / 2;
    outline.scale.y = displayHeight;
    outline.position.y = mesh.position.y;

    (mesh.material as THREE.Material[]).forEach((material: any) => {
      if (material.emissive) {
        material.emissiveIntensity = displayHeight > 0.01 ? 0.2 : 0;
      }
    });
    
    // Validate that stored height matches character count (except during temporary animations)
    if (targetHeight === null) {
      const expectedHeight = this.baseHeightFor(key);
      if (Math.abs(this.keyHeights[key] - expectedHeight) > 0.001) {
        console.warn(`Height mismatch for key ${key}: stored=${this.keyHeights[key]}, expected=${expectedHeight}`);
        // Force correction
        this.keyHeights[key] = expectedHeight;
      }
    }
  }

  createWaveEffect(sourceKey: string) {
    const sourcePos = this.keyObjects[sourceKey].position.clone();
    Object.entries(this.keyObjects).forEach(([key, mesh]) => {
      // Structural (extra) keys are inert placeholders — no ripple impression.
      if (this.structuralKeys.has(key)) return;
      const distance = sourcePos.distanceTo(mesh.position);
      if (distance <= this.waveRadius && key !== sourceKey) {
        this.keyWaves[key] = {
          time: 0,
          active: true,
          distance: distance
        };
      }
    });
  }

  updateWaves() {
    Object.entries(this.keyWaves).forEach(([key, wave]) => {
      if (wave.active) {
        wave.time += this.waveSpeed;
        const mesh = this.keyObjects[key];
        const outline = this.outlineObjects[key];
        
        if (wave.time >= Math.PI) {
          this.resetWave(key, wave, mesh, outline);
        } else {
          this.updateWavePosition(key, wave, mesh, outline);
        }
      }
    });
  }

  resetWave(key: string, wave: any, mesh: THREE.Mesh, outline: THREE.LineSegments) {
    wave.active = false;
    wave.time = 0;
    mesh.position.y = (this.keySize * this.keyHeights[key]) / 2;
    outline.position.y = mesh.position.y;
  }

  updateWavePosition(key: string, wave: any, mesh: THREE.Mesh, outline: THREE.LineSegments) {
    const waveOffset = Math.sin(wave.time) * this.waveHeight * 
      (1 - wave.distance / this.waveRadius);
    mesh.position.y = (this.keySize * this.keyHeights[key]) / 2 + waveOffset;
    outline.position.y = mesh.position.y;
  }

  updateIdleAnimation() {
    const idle = this.config.animation.idle;
    this.idleAnimationTime += idle.speed;

    Object.entries(this.keyObjects).forEach(([key, mesh]) => {
      // A transient animation (e.g. the delete-key press) owns this key's height.
      if (this.animatingKeys.has(key)) return;

      // Base height: data keys rise from their value; structural keys rest at their
      // configured height (so the surrounding board reads as real keys, not flat).
      const baseHeight = this.baseHeightFor(key);
      this.keyHeights[key] = baseHeight; // keep stored height authoritative

      // `flow` controls how much the wave travels across X (0 = unison; higher =
      // traveling ripple). Structural keys breathe only when idle.structural is on.
      const animate = idle.enabled && (idle.structural || !this.structuralKeys.has(key));
      const offset = animate
        ? Math.sin(this.idleAnimationTime + mesh.position.x * idle.flow) * idle.amplitude
        : 0;
      const animatedHeight = Math.max(0.01, baseHeight + offset);

      mesh.scale.y = animatedHeight;
      mesh.position.y = (this.keySize * animatedHeight) / 2;

      const outline = this.outlineObjects[key];
      outline.scale.y = animatedHeight;
      outline.position.y = mesh.position.y;
    });
  }

  updateFromText(text: string) {
    this.resetAllKeys();
    
    if (!text || text === "type something…") {
      return;
    }

    // Always process text input for automatic key growth
    this.processTextInput(text);
  }

  resetAllKeys() {
    this.maxDataValue = 0;
    // CRITICAL: Reset both counts and heights to maintain relationship
    Object.keys(this.keyHeights).forEach(key => {
      this.keyTypeCounts[key] = 0;
      this.keyHeights[key] = this.baseHeightFor(key); // structural keys rest at their height
      this.updateKeyObject(key);
    });
  }

  private computeCounts(text: string): Record<string, number> {
    const counts: Record<string, number> = {};
    const src = this.config.data.caseSensitive ? text : text.toLowerCase();
    src.split('').forEach(char => {
      if (this.keyObjects[char]) {
        counts[char] = (counts[char] || 0) + 1;
      }
    });
    return counts;
  }

  /** Resolve the value (key height multiplier) for a label per the configured data mode. */
  private computeValue(label: string, text: string, counts: Record<string, number>): number {
    const d = this.config.data;
    if (d.mode === 'static') return d.staticValues?.[label] ?? 0;
    if (d.mode === 'custom' && d.valueFn) return d.valueFn(label, text, counts);
    return counts[label] || 0; // 'frequency'
  }

  processTextInput(text: string) {
    const counts = this.computeCounts(text);

    // Pass 1: set every key's value, then refresh the cached max so the height
    // auto-scale (effectivePerTap) sees the final distribution before sizing.
    Object.keys(this.keyObjects).forEach(char => {
      this.keyTypeCounts[char] = this.computeValue(char, text, counts);
    });
    this.recomputeMaxValue();

    // Pass 2: size each key from the (now proportional) per-tap rise.
    Object.keys(this.keyObjects).forEach(char => {
      this.keyHeights[char] = this.baseHeightFor(char);
      this.updateKeyObject(char);
      if ((this.keyTypeCounts[char] || 0) > 0) {
        this.createWaveEffect(char);
      }
    });
  }

  /** Whether a given label has a key in the current layout. */
  hasKey(label: string): boolean {
    return !!this.keyObjects[label];
  }

  /** The id of the layout's delete/backspace key, or null if it has none. */
  deleteKeyId(): string | null {
    return this.keyObjects['backspace'] ? 'backspace' : null;
  }

  /** Pick the key under a normalized-device-coords point, or null. */
  pickKeyId(ndc: THREE.Vector2, camera: THREE.Camera): string | null {
    this.raycaster.setFromCamera(ndc, camera);
    const hits = this.raycaster.intersectObjects(Object.values(this.keyObjects), true);
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        const id = obj.userData?.keyId as string | undefined;
        if (id) return id;
        obj = obj.parent;
      }
    }
    return null;
  }

  /**
   * Press a key down and let it spring back (used for the delete key). Colour is
   * handled separately via highlightKey() so the press composes with the subtle
   * hover/accent tint instead of replacing the material with a heavy solid fill.
   */
  async pressKey(id: string): Promise<void> {
    const mesh = this.keyObjects[id];
    if (!mesh || this.animatingKeys.has(id)) return;
    this.animatingKeys.add(id);
    const fromH = this.keyHeights[id] || this.structuralKeyHeight || 0.01;
    const downH = Math.max(0.06, fromH * 0.2);
    await this.animateKeyHeight(id, fromH, downH, 230);
    this.animatingKeys.delete(id);
    this.updateKeyObject(id);
  }

  /** Ease a key down to `toH` then back to `fromH` over `dur` ms (press feel). */
  private animateKeyHeight(id: string, fromH: number, toH: number, dur: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        if (!this.animatingKeys.has(id)) return resolve(); // bailed (e.g. teardown)
        const p = Math.min((now - start) / dur, 1);
        const tri = p < 0.5 ? p * 2 : 1 - (p - 0.5) * 2; // 0 → 1 → 0 (down then up)
        const eased = 1 - Math.pow(1 - tri, 2);
        this.updateKeyObject(id, fromH - (fromH - toH) * eased);
        if (p < 1) requestAnimationFrame(step);
        else {
          this.updateKeyObject(id, fromH);
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  /** Read-only snapshot of the current per-key values, for the `data` event. */
  snapshot(): { counts: Record<string, number>; heights: Record<string, number> } {
    return { counts: { ...this.keyTypeCounts }, heights: { ...this.keyHeights } };
  }

  async animateKeyDown(key: string, startHeight: number) {
    return new Promise<void>(resolve => {
      const steps = 60;
      // const duration = 1000; // Fixed duration for smooth animation - unused
      let currentStep = 0;
      
      const animate = () => {
        if (currentStep >= steps) {
          this.updateKeyObject(key, 0);
          this.createWaveEffect(key);
          resolve();
          return;
        }
        
        const progress = currentStep / (steps - 1);
        const easeProgress = 1 - Math.pow(1 - progress, 2);
        const height = startHeight * (1 - easeProgress);
        this.updateKeyObject(key, height);
        
        currentStep++;
        requestAnimationFrame(animate);
      };
      
      animate();
    });
  }

  async clear(currentText: string = '') {
    if (this.clearAnimationInProgress) return;
    this.clearAnimationInProgress = true;

    if (currentText && currentText.trim()) {
      await this.animateBackspaceSequence(currentText);
    } else {
      // If no text, just clear all keys normally
      await this.clearAllKeysInstantly();
    }

    this.clearAnimationInProgress = false;
  }

  /** Emit the current display text + per-key data during an animation step. */
  private emitProgress(text: string) {
    const { counts, heights } = this.snapshot();
    this.emit('textchange', {
      text,
      length: text.length,
      max: this.config.features.maxCharacters,
      source: 'program',
    });
    this.emit('data', { text, counts, heights, mode: this.config.data.mode });
  }

  async animateTypingSequence(newText: string) {
    const chars = newText.toLowerCase().split('');
    const initialDelay = 50;  // Start slower (3x faster)
    const finalDelay = 10;    // End faster (3x faster)
    
    // Reset all keys to zero before starting
    this.resetAllKeys();

    // Clear current text display first
    this.emitProgress('');

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const currentText = newText.substring(0, i + 1);
      
      // Calculate accelerating delay - starts slow, gets faster
      const progress = i / (chars.length - 1);
      const currentDelay = initialDelay - (initialDelay - finalDelay) * Math.pow(progress, 2);
      
      // Animate key press if it exists
      if (this.keyObjects[char]) {
        await this.animateKeyPress(char);
        
        // CRITICAL: Increment count and recalculate height based on count
        this.keyTypeCounts[char] = (this.keyTypeCounts[char] || 0) + 1;
        this.recomputeMaxValue();
        this.keyHeights[char] = this.baseHeightFor(char);
        this.updateKeyObject(char);
      }

      // Emit the in-progress text + data for any view modules
      this.emitProgress(currentText);

      // Wait before next key press
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }

  async animateBackspaceSequence(text: string) {
    const chars = text.toLowerCase().split('').reverse(); // Reverse for backspace order
    const initialDelay = 20;  // Start slower (3x faster)
    const finalDelay = 3;     // End faster (3x faster)
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      
      // Calculate accelerating delay - starts slow, gets faster
      const progress = i / (chars.length - 1);
      const currentDelay = initialDelay - (initialDelay - finalDelay) * Math.pow(progress, 2);
      
      if (this.keyObjects[char]) {
        // Animate key press (down and up)
        await this.animateKeyPress(char);

        // CRITICAL: Decrement count and recalculate height based on count
        if (this.keyTypeCounts[char] > 0) {
          this.keyTypeCounts[char]--;
          this.recomputeMaxValue();
          this.keyHeights[char] = this.baseHeightFor(char);
          this.updateKeyObject(char);
        }

        // Emit the shrinking text + data to update view modules
        this.emitProgress(text.substring(0, chars.length - i - 1));
      }

      // Wait before next key press
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }

    // Final cleanup - ensure all keys are reset
    await this.clearAllKeysInstantly();

    // Reset view to empty after backspace completes
    this.emitProgress('');
  }

  private async animateKeyPress(key: string) {
    const mesh = this.keyObjects[key];
    const outline = this.outlineObjects[key];
    if (!mesh || !outline) return;

    const originalHeight = this.keyHeights[key] || 0.01;
    const pressDepth = this.config.animation.keyPressDepth; // How far down the key goes when pressed
    const totalDuration = 100; // Total animation time in ms
    const startTime = performance.now();

    return new Promise<void>(resolve => {
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / totalDuration, 1);
        
        // Create a press-release cycle: down for first half, up for second half
        let heightOffset;
        if (progress < 0.5) {
          // Press down (first half)
          const pressProgress = progress * 2;
          heightOffset = -pressDepth * Math.sin(pressProgress * Math.PI / 2);
        } else {
          // Release up (second half) 
          const releaseProgress = (progress - 0.5) * 2;
          heightOffset = -pressDepth * Math.cos(releaseProgress * Math.PI / 2);
        }
        
        const currentHeight = originalHeight + heightOffset;
        this.updateKeyObject(key, Math.max(0.01, currentHeight));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure key returns to original height
          this.updateKeyObject(key, originalHeight);
          this.createWaveEffect(key);
          resolve();
        }
      };
      
      requestAnimationFrame(animate);
    });
  }

  private async clearAllKeysInstantly() {
    // CRITICAL: Reset both counts and heights to maintain relationship
    Object.keys(this.keyHeights).forEach(key => {
      this.keyTypeCounts[key] = 0;
      this.keyHeights[key] = this.baseHeightFor(key); // structural keys rest at their height
      this.updateKeyObject(key);
    });
  }

  increaseHeight() {
    // Implementation removed - unused
  }

  decreaseHeight() {
    // Implementation removed - unused
  }

  updateRotation() {
    if (!this.rotationState.isRotating) return;

    const currentTime = performance.now();
    const elapsed = currentTime - this.rotationState.startTime;
    
    if (elapsed >= this.rotationState.rotationDuration) {
      // Complete the rotation and stop
      this.container.rotation.y = this.rotationState.targetRotation;
      this.rotationState.isRotating = false;
      return;
    }

    const progress = elapsed / this.rotationState.rotationDuration;
    const easedProgress = 1 - Math.cos(progress * Math.PI / 2); // Smooth easing
    const newRotation = this.rotationState.initialRotation + 
      (this.rotationState.targetRotation - this.rotationState.initialRotation) * easedProgress;
    
    this.container.rotation.y = newRotation;
  }

  update() {
    this.updateWaves();
    this.updateIdleAnimation();
    this.updateRotation();
  }

  startAiRemixAnimation() {
    // AI Remix now uses typing animation instead of ripple effects
    // This method is kept for compatibility but doesn't start ripple animation
  }

  stopAiRemixAnimation() {
    // AI Remix typing animation handles its own completion
    // This method is kept for compatibility
  }

  // Method removed - was unused

  // Method removed - was unused

  updateTheme(isDarkMode: boolean) {
    this.isDarkMode = isDarkMode;
    const colors = this.theme();

    // Update key materials (key caps)
    Object.entries(this.keyMaterials).forEach(([key, materials]) => {
      // Update the top material (key cap) - index 2
      // Need to recreate the material since we're switching between Basic and Physical
      const mesh = this.keyObjects[key];
      if (mesh) {
        const previousTopMaterial = materials[2];
        const newTopMaterial = isDarkMode
          ? new THREE.MeshBasicMaterial({
              color: new THREE.Color(colors.keyTop), // Dark mode key caps
              transparent: false
            })
          : new THREE.MeshPhysicalMaterial({
              color: new THREE.Color(colors.keyTop),
              metalness: 0.1,
              roughness: 0.2,
              clearcoat: 0.8,
              clearcoatRoughness: 0.1,
              emissive: new THREE.Color(colors.keyTop),
              emissiveIntensity: 0.3,
              transparent: false
            });
        newTopMaterial.shadowSide = THREE.FrontSide;

        // Update the material array
        (materials as any)[2] = newTopMaterial;

        // Update the mesh materials
        if (Array.isArray(mesh.material)) {
          mesh.material[2] = newTopMaterial;
        }
        previousTopMaterial?.dispose();
      }

      // Update side materials - indices 0, 1, 3, 4, 5
      [0, 1, 3, 4, 5].forEach(index => {
        const sideMaterial = materials[index] as unknown as THREE.MeshBasicMaterial;
        if (sideMaterial) {
          sideMaterial.color.set(colors.keySide);
        }
      });
    });

    // Update text materials
    Object.values(this.textMaterials).forEach(textMaterial => {
      textMaterial.color.set(colors.keyText);
    });

    // Update all existing outlines
    Object.values(this.outlineObjects).forEach(outline => {
      if (outline.material) {
        (outline.material as any).color.set(colors.outline);
        (outline.material as any).opacity = colors.outlineOpacity;
      }
    });

    // Update all existing base outlines
    Object.values(this.baseOutlineObjects).forEach(baseOutline => {
      if (baseOutline.material) {
        (baseOutline.material as any).color.set(colors.baseOutline);
        (baseOutline.material as any).opacity = colors.baseOutlineOpacity;
      }
    });

    // Keep the boundary stroke / 3D frame on the current theme's outline color.
    this.updateBoundary();

    // Theme rebuild reset outline opacities + recreated cap tops — re-apply.
    this.applyOpacities();
  }

  updateKeyCapFont(_fontFamily: string, fontName: string) {
    // Map font to closest available Three.js font or use System as fallback
    let targetFont = this.loadedFonts[fontName];
    
    if (!targetFont) {
      // Try to map to a similar loaded font based on characteristics
      if (fontName.toLowerCase().includes('serif') || fontName.toLowerCase().includes('display') || fontName.toLowerCase().includes('playfair')) {
        targetFont = this.loadedFonts['Georgia'];
      } else if (fontName.toLowerCase().includes('condensed') || fontName.toLowerCase().includes('narrow')) {
        targetFont = this.loadedFonts['Roboto Condensed'];
      } else if (fontName.toLowerCase().includes('inter') || fontName.toLowerCase().includes('grotesk') || fontName.toLowerCase().includes('sans')) {
        targetFont = this.loadedFonts['Inter'];
      } else {
        targetFont = this.loadedFonts['System'];
      }
      
      if (!targetFont) {
        console.warn(`Font ${fontName} not loaded and no fallback available`);
        return;
      }
      
      console.log(`Font ${fontName} not available in 3D, using fallback`);
    }

    // Update current font
    this.currentFont = targetFont;

    // Recreate all text objects with new font
    Object.entries(this.textObjects).forEach(([key, textMesh]) => {
      const keyMesh = this.keyObjects[key];
      if (!keyMesh) return;

      // Remove old text mesh
      keyMesh.remove(textMesh);
      textMesh.geometry.dispose();
      
      // Create new text material
      const textMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(this.theme().keyText),
        metalness: 0,
        roughness: 1
      });

      // Create new text mesh with current font (use the cap's label, not its id)
      const newTextMesh = this.createKeyText(this.keyLabels[key] ?? key, this.currentFont, textMaterial);
      
      // Apply font-specific styling
      this.applyFontStyling(newTextMesh, fontName);
      
      // Add to key mesh
      keyMesh.add(newTextMesh);
      
      // Update references
      this.textObjects[key] = newTextMesh;
      this.textMaterials[key] = textMaterial;
    });

    // Label materials were recreated opaque — re-apply opacity channels.
    this.applyOpacities();
  }

  /**
   * Recreate every engraved label from the current font + typography (size, anchor,
   * weight). Same recreate-and-reapply path as updateKeyCapFont, but keeps the
   * active font — used by the live keycap-typography setters below.
   */
  rebuildLabels() {
    if (!this.currentFont) return;
    const fontName =
      Object.keys(this.loadedFonts).find((k) => this.loadedFonts[k] === this.currentFont) ??
      this.config.typography.defaultFont;

    Object.entries(this.textObjects).forEach(([key, textMesh]) => {
      const keyMesh = this.keyObjects[key];
      if (!keyMesh) return;
      keyMesh.remove(textMesh);
      textMesh.geometry.dispose();

      const textMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(this.theme().keyText),
        metalness: 0,
        roughness: 1,
      });
      const newTextMesh = this.createKeyText(this.keyLabels[key] ?? key, this.currentFont, textMaterial);
      this.applyFontStyling(newTextMesh, fontName);
      keyMesh.add(newTextMesh);
      this.textObjects[key] = newTextMesh;
      this.textMaterials[key] = textMaterial;
    });
    this.applyOpacities();
  }

  /** Engraved-letter size (config.typography.textSize). Recreates label geometry. */
  setTextSize(size: number) {
    this.config.typography.textSize = Math.max(0.5, Math.min(6, size));
    this.rebuildLabels();
  }

  /** Where the engraved letter sits on the cap (3×3 anchor). */
  setLabelAnchor(anchor: LabelAnchor) {
    this.config.typography.labelAnchor = anchor;
    this.rebuildLabels();
  }

  /** Engraved-letter stroke weight (1 = natural, >1 fattens via bevel). */
  setLabelWeight(weight: number) {
    this.config.typography.labelWeight = Math.max(0.5, Math.min(2, weight));
    this.rebuildLabels();
  }

  private applyFontStyling(textMesh: THREE.Mesh, fontName: string) {
    const textMaterial = textMesh.material as THREE.MeshPhysicalMaterial;
    
    switch (fontName) {
      case 'Georgia':
        // Serif fonts - elegant and refined
        textMaterial.roughness = 0.8;
        textMaterial.metalness = 0.05;
        textMesh.scale.set(0.95, 0.95, 1);
        break;
        
      case 'Roboto Condensed':
        // Condensed font - narrower and taller
        textMaterial.roughness = 0.9;
        textMaterial.metalness = 0;
        textMesh.scale.set(0.85, 1.1, 1);
        break;
        
      case 'Inter':
        // Modern sans-serif - clean and sharp
        textMaterial.roughness = 1.0;
        textMaterial.metalness = 0;
        textMesh.scale.set(1, 1, 1);
        break;
        
      default: // 'System'
        // Default balanced styling
        textMaterial.roughness = 1.0;
        textMaterial.metalness = 0;
        textMesh.scale.set(1, 1, 1);
        break;
    }
    
    textMaterial.needsUpdate = true;
  }
}
