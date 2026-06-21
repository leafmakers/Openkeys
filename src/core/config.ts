/**
 * OpenKeys configuration.
 *
 * A single source of truth for everything that used to be a magic number
 * scattered across scene.ts / keyboard.ts / ui.ts. `defaultConfig` reproduces
 * the original hardcoded behavior exactly, so an empty config === the classic app.
 *
 * The three core concerns are deliberately separated so the keyboard is just the
 * default preset:
 *   - layout : where the cells sit (rows / dimensions)
 *   - data   : what drives each cell's height (label -> value)
 *   - render : how it looks (theme / scene / lights / animation / typography)
 */

export type Vec3 = [number, number, number];

/**
 * Base path for bundled assets (fonts, optional HDR). Respects Vite's `base`
 * so assets resolve correctly under a sub-path deploy (e.g. GitHub Pages).
 * `BASE_URL` always ends with a slash.
 */
const ASSET_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL) || '/';

export type DataMode = 'frequency' | 'static' | 'custom';

export interface ThemeColors {
  /** Scene + page background. */
  background: string;
  /** Ground plane color. */
  floor: string;
  /** Top face of each key. */
  keyTop: string;
  /** Side faces of each key. */
  keySide: string;
  /** Engraved character on each key. */
  keyText: string;
  /** Key edge outline. */
  outline: string;
  /** Key edge outline opacity. */
  outlineOpacity: number;
  /** Flat square outline drawn on the floor under each key. */
  baseOutline: string;
  /** Floor base-outline opacity. */
  baseOutlineOpacity: number;
}

export interface LightSpec {
  color: string;
  intensity: number;
  position: Vec3;
}

export interface KeyCapFont {
  name: string;
  /** URL or path to a three.js `.typeface.json` font. */
  url: string;
}

/**
 * A rich key descriptor. Use this (instead of a bare string) when a key needs a
 * width other than 1u, a label that differs from its identity, or a duplicate
 * label (e.g. two "shift" keys need distinct ids).
 */
export interface KeyDef {
  /** Unique id within the layout. For data keys this IS the typed character. */
  id: string;
  /** Glyph drawn on the cap. Empty string = a blank cap (e.g. the space bar). */
  label: string;
  /** Width in key units (1u = one standard key). Defaults to 1. */
  w?: number;
  /** Whether the key grows in response to typed text. Defaults to true. */
  typeable?: boolean;
}

/** A cell is either a plain label (1u typeable data key) or a rich descriptor. */
export type Cell = string | KeyDef;

export interface LayoutConfig {
  /** Grid of cells. Default = QWERTY. Any grid works (azerty, dvorak, numpad, full, custom). */
  rows: Cell[][];
  /** Cube edge length for each key. */
  keySize: number;
  /** Z distance between rows. */
  spacing: number;
  /** Per-row horizontal stagger multiplier (row index * this many units). Classic keyboard = 5. */
  rowStagger: number;
  /** Horizontal gap added between keys within a row. */
  keyGap: number;
  /**
   * World-space left edge / front row used to position the board. Optional —
   * defaults (-50 / -20) reproduce the classic hardcoded placement. Wide
   * layouts (e.g. 'full') override these to re-centre the larger footprint.
   */
  originX?: number;
  originZ?: number;
  /**
   * Opacity (0–1) applied to structural keys — every cell with `typeable: false`
   * (modifiers, space bar, punctuation; i.e. everything outside the original 36
   * alphanumeric data keys). Lets the data keys read as the content while the
   * surrounding board recedes. Default 1 (no fade); data keys are never faded.
   */
  structuralKeyOpacity?: number;
  /**
   * Resting height (key-height units, same scale as `growthIncrement × count`)
   * for structural keys, so the non-data keys read as real keys instead of lying
   * flat. 0 = flat (old behavior). Default 0.6 ≈ a key tapped once. Data keys are
   * unaffected — they always rise from their value.
   */
  structuralKeyHeight?: number;
  /**
   * Resting/starting height for the data (main 36) keys — a baseline the bars
   * grow from: height = mainKeyHeight + growthIncrement × count. 0 = flat at rest
   * (classic). Raise it so the whole board starts at a height, matching the look
   * of the raised structural keys. Data keys still rise further as you type.
   */
  mainKeyHeight?: number;
  /** Named preset, for the settings UI. */
  preset?: 'qwerty' | 'azerty' | 'dvorak' | 'numpad' | 'full' | 'custom';
}

export interface DataConfig {
  /**
   * What drives key height:
   *  - 'frequency' : count how often each label appears in `text` (classic behavior)
   *  - 'static'    : use `staticValues` directly
   *  - 'custom'    : call `valueFn(label, text, counts)`
   */
  mode: DataMode;
  /** Base height per unit of value (rise per tap), before proportional auto-scaling. */
  growthIncrement: number;
  /**
   * Composition ceiling for the GROWTH portion of the tallest data key. When the
   * busiest key would exceed this, the per-tap rise scales down proportionally so the
   * tallest key sits at the ceiling (like the headline that shrinks to fit) — keeping
   * long, repetitive sentences from blowing the composition out. 0 = uncapped
   * (classic linear growth). Structural keys are unaffected.
   */
  maxKeyHeight?: number;
  /** Lowercase text before counting (classic behavior). */
  caseSensitive: boolean;
  /** Which characters count toward height. */
  includeChars: RegExp;
  /** mode: 'static' */
  staticValues?: Record<string, number>;
  /** mode: 'custom' */
  valueFn?: (label: string, text: string, counts: Record<string, number>) => number;
}

export interface ThemeConfig {
  mode: 'light' | 'dark';
  light: ThemeColors;
  dark: ThemeColors;
  /** Optional named palettes selectable from the settings UI / URL. */
  presets?: Record<string, { light?: Partial<ThemeColors>; dark?: Partial<ThemeColors> }>;
}

/** Where the engraved label sits on each cap's top face (a 3×3 anchor grid). */
export type LabelAnchor =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export interface TypographyConfig {
  /** 3D key-cap typefaces (three.js typeface.json). */
  keyCapFonts: KeyCapFont[];
  /** Name of the key-cap font used at startup (must match one of keyCapFonts). */
  defaultFont: string;
  /** Engraved glyph size. */
  textSize: number;
  /** Curve smoothness for the engraved glyphs. */
  curveSegments: number;
  /** Placement of the engraved label on the cap top. Default 'center'. */
  labelAnchor?: LabelAnchor;
  /**
   * Stroke weight of the engraved label: 1 = the font's natural weight, >1 fattens
   * the strokes via an in-plane bevel (the keycap typefaces ship a single weight,
   * so this approximates bold without a second font). Default 1.
   */
  labelWeight?: number;
  /** Optional Google Fonts API key. When absent the font drawer degrades gracefully. */
  googleFontsApiKey?: string;
}

/**
 * OrbitControls tuning. Angles are radians (OrbitControls' native unit); the
 * settings UI converts to/from degrees. Azimuth min/max default to ±Infinity
 * (free horizontal spin); set finite values to fence it in.
 */
export interface OrbitControlsConfig {
  target: Vec3;
  /** Master switch for click-drag orbiting. */
  enableRotate: boolean;
  /** Master switch for scroll/pinch zoom. */
  enableZoom: boolean;
  /** Master switch for right-drag / two-finger pan. */
  enablePan: boolean;
  /** Inertia after the user lets go. */
  enableDamping: boolean;
  dampingFactor: number;
  /** Speed multipliers for the respective gestures. */
  rotateSpeed: number;
  zoomSpeed: number;
  /** Vertical orbit fence (radians from straight-down). */
  minPolarAngle: number;
  maxPolarAngle: number;
  /** Horizontal orbit fence (radians). ±Infinity = unrestricted. */
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  /** Orthographic zoom fence (camera.zoom multiplier). */
  minZoom: number;
  maxZoom: number;
  /**
   * Perspective dolly fence (world-space camera→target distance). OrbitControls'
   * min/maxZoom only bind an OrthographicCamera; a PerspectiveCamera zooms by
   * changing distance, so these bound it. They also keep the camera between the
   * near/far planes — without an upper bound, dollying out would clip the board
   * past `far`; without a lower bound, dollying in would clip it against `near`.
   * (Ignored by OrbitControls for an OrthographicCamera.)
   */
  minDistance: number;
  maxDistance: number;
  /** Hands-free turntable spin. */
  autoRotate: boolean;
  autoRotateSpeed: number;
}

export interface CameraConfig {
  /**
   * Projection model. 'orthographic' = parallel projection (no perspective
   * distortion — the classic look); 'perspective' = real depth/foreshortening.
   */
  projection: 'orthographic' | 'perspective';
  near: number;
  far: number;
  /** Orthographic frustum half-size, per breakpoint (the ortho "zoom level"). */
  frustum: { mobile: number; desktop: number };
  /** Perspective field of view in degrees (ignored for orthographic). Low ≈
   *  telephoto/near-parallel; high = wide-angle with strong perspective. */
  fov: number;
  position: { mobile: Vec3; desktop: Vec3 };
  lookAt: { mobile: Vec3; desktop: Vec3 };
  controls: OrbitControlsConfig;
}

export interface LightsConfig {
  ambient: { color: string; intensity: number };
  key: LightSpec;
  fill: LightSpec;
  back: LightSpec;
  rim: LightSpec;
  /** Orbit radius/height used by the shadow-angle slider. */
  keyOrbit: { radius: number; height: number };
  shadowMapSize: number;
}

export interface SceneConfig {
  /** Hard cap on devicePixelRatio. */
  pixelRatioCap: number;
  antialias: boolean;
  toneMappingExposure: number;
  /** MUST stay true — poster export reads pixels back off the WebGL canvas. */
  preserveDrawingBuffer: boolean;
  /** Below this width (px) the mobile camera/frustum and input behavior kick in. */
  mobileBreakpoint: number;
  /** Optional HDR environment map. Off by default — the lights render fine without it. */
  environment: { enabled: boolean; url?: string };
  floor: { enabled: boolean; size: number; halftone: boolean };
  /**
   * A rounded frame around the whole keyboard, offset outward by `gap`. At
   * `height: 0` it's a thin stroke traced on the floor (a framing accent); raise
   * `height` and it extrudes into a solid 3D rim/frame of radial `thickness`. It
   * lives in the keyboard container, so it rotates with the board (intro spin).
   */
  boundary: {
    enabled: boolean;
    /** Outward offset from the keyboard footprint, in world units. */
    gap: number;
    /** Corner radius, in world units. */
    radius: number;
    /** Opacity (uses the theme outline color) — stroke at height 0, fill when 3D. */
    opacity: number;
    /**
     * Vertical height of the 3D frame, in world units. 0 keeps the flat stroke;
     * any positive value extrudes the frame up off the floor.
     */
    height: number;
    /**
     * Radial wall width of the 3D frame band, in world units (how "thick" the
     * boundary reads). Only applies when `height` > 0.
     */
    thickness: number;
  };
}

export interface AnimationConfig {
  intro: { enabled: boolean; duration: number; pause: number };
  /**
   * Ambient "breathing" motion of the keys.
   *  - amplitude : how far keys rise/fall (subtlety of the bob)
   *  - speed     : tempo of the bob
   *  - flow      : spatial spread across the board (0 = all keys in unison;
   *                higher = a traveling ripple along the X axis)
   *  - structural: whether structural (non-data) keys also breathe (default false —
   *                only the data keys bob, the surrounding board stays still)
   */
  idle: { enabled: boolean; amplitude: number; speed: number; flow: number; structural?: boolean };
  wave: { speed: number; radius: number; height: number };
  typing: { enabled: boolean };
  keyPressDepth: number;
}

export interface BrandingConfig {
  title: string;
  showNavbar: boolean;
  /** Downloaded poster filename prefix -> `${prefix}-<timestamp>.png`. */
  posterFilenamePrefix: string;
}

export interface FeaturesConfig {
  poster: boolean;
  settingsPanel: boolean;
  /**
   * Enables the full font-library drawer (Google Fonts catalog browsing + pinning).
   * When false (the default), the font control is cycle-only: tapping/clicking the
   * font name cycles the pinned favorites, with no drawer. Toggleable live from the
   * settings panel. The quick-cycle controls are always present either way.
   */
  fontDrawer: boolean;
  themeToggle: boolean;
  /** Editable text input + type-anywhere. */
  textInput: boolean;
  /** Per-letter frequency bar. */
  characterBar: boolean;
  /** Live words-per-minute readout. */
  typingSpeed: boolean;
  /** Keystroke sounds (synthesized click on type + on clear). */
  sound: boolean;
  /**
   * Hover spotlight: hovering a frequency-bar segment tints the matching 3D key
   * with that segment's color. Desktop nicety; the "others" segment is excluded.
   */
  hoverHighlight: boolean;
  maxCharacters: number;
}

/**
 * Global opacity multipliers for the three visual channels of every key. Each is
 * 0–1 and scales the channel's *natural* opacity (so 1 = the design default, not
 * "fully opaque"). They compose multiplicatively with the per-key structural
 * fade (`LayoutConfig.structuralKeyOpacity`).
 */
export interface AppearanceConfig {
  /** Multiplier for the data (main 36) key-cap TOP face. */
  faceOpacity: number;
  /** Multiplier for the data-key SIDE faces (walls). */
  wallOpacity: number;
  /** Multiplier for the data-key edge + base outlines. */
  outlineOpacity: number;
  /** Multiplier for the data-key engraved labels. */
  textOpacity: number;
  /** Multiplier for the structural (extra) key TOP face. */
  extraFaceOpacity: number;
  /** Multiplier for the structural (extra) key SIDE faces (walls). */
  extraWallOpacity: number;
  /** Multiplier for the structural-key edge + base outlines. */
  extraOutlineOpacity: number;
  /** Multiplier for the structural-key engraved labels. */
  extraTextOpacity: number;
}

/** The text-input block caret (the typing cursor). Sized in `em` so it scales with
 *  the auto-fitting headline; both are live-tunable from the settings panel. */
export interface CursorConfig {
  /** Caret thickness in em (width relative to the font size). */
  thickness: number;
  /** Corner rounding, 0 (square) … 1 (fully rounded / capsule ends). */
  rounding: number;
}

export interface OpenKeysConfig {
  /** Initial phrase. */
  text: string;
  layout: LayoutConfig;
  data: DataConfig;
  theme: ThemeConfig;
  typography: TypographyConfig;
  camera: CameraConfig;
  lights: LightsConfig;
  scene: SceneConfig;
  animation: AnimationConfig;
  appearance: AppearanceConfig;
  cursor: CursorConfig;
  branding: BrandingConfig;
  features: FeaturesConfig;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<U>
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

/** Classic QWERTY rows (the original hardcoded keyMap). */
export const QWERTY_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

export const AZERTY_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
  ['w', 'x', 'c', 'v', 'b', 'n'],
];

export const DVORAK_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['p', 'y', 'f', 'g', 'c', 'r', 'l'],
  ['a', 'o', 'e', 'u', 'i', 'd', 'h', 't', 'n', 's'],
  ['q', 'j', 'k', 'x', 'b', 'm', 'w', 'v', 'z'],
];

export const NUMPAD_ROWS: string[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['0'],
];

// --- Full layout (experimental) ---------------------------------------------
// A Mac-style ~60% board. The 36 alphanumeric keys are the same typeable data
// keys as QWERTY; everything else is an inert structural key (modifier, space,
// punctuation) that fills the board out to a clean rectangle. Every row is
// exactly 15u wide, so the silhouette is rectangular even though the letters
// keep their classic stagger (which comes from the edge-key widths, not row
// offsets). Toggle off instantly with the QWERTY preset / `?layout=qwerty`.
const m = (id: string, label: string, w = 1): KeyDef => ({ id, label, w, typeable: false });
const d = (chars: string): KeyDef[] =>
  chars.split('').map((c) => ({ id: c, label: c, w: 1, typeable: true }));

export const FULL_ROWS: Cell[][] = [
  // ` 1 2 3 4 5 6 7 8 9 0 - = [del]
  [m('backtick', '`'), ...d('1234567890'), m('minus', '-'), m('equals', '='), m('backspace', 'del', 2)],
  // tab q w e r t y u i o p [ ] \
  [m('tab', 'tab', 1.5), ...d('qwertyuiop'), m('lbracket', '['), m('rbracket', ']'), m('backslash', '\\', 1.5)],
  // caps a s d f g h j k l ; ' return
  [m('caps', 'caps', 1.75), ...d('asdfghjkl'), m('semicolon', ';'), m('quote', "'"), m('enter', 'return', 2.25)],
  // shift z x c v b n m , . / shift
  [m('lshift', 'shift', 2.25), ...d('zxcvbnm'), m('comma', ','), m('period', '.'), m('slash', '/'), m('rshift', 'shift', 2.75)],
  // ctrl opt cmd [space] cmd opt ctrl
  [m('lctrl', 'ctrl', 1.25), m('lopt', 'opt', 1.25), m('lcmd', 'cmd', 1.25), m('space', '', 7.5), m('rcmd', 'cmd', 1.25), m('ropt', 'opt', 1.25), m('rctrl', 'ctrl', 1.25)],
];

export const LAYOUT_PRESETS: Record<string, Cell[][]> = {
  qwerty: QWERTY_ROWS,
  azerty: AZERTY_ROWS,
  dvorak: DVORAK_ROWS,
  numpad: NUMPAD_ROWS,
  full: FULL_ROWS,
};

/**
 * Extra config for presets that need more than swapped rows. The 'full' board is
 * flush (no row stagger) and wider/deeper, so it re-centres via origin AND zooms
 * the orthographic camera out so the larger footprint fits on every viewport.
 * Derivation: board = 15u → 15*keySize(10) + 14*keyGap(2) = 178 wide; centre on
 * x≈9 (the QWERTY centre) → originX = 9 - 178/2 = -80. originZ nudges the 5 rows
 * back so they sit in frame. Frustum is bumped ~1.5x (178u vs QWERTY's ~118u) so
 * portrait/mobile views don't clip the right column.
 */
export const LAYOUT_OVERRIDES: Record<string, DeepPartial<OpenKeysConfig>> = {
  full: {
    layout: { rowStagger: 0, originX: -80, originZ: -26, structuralKeyOpacity: 0.9 },
    camera: { frustum: { mobile: 70, desktop: 120 } },
  },
};

/**
 * The DeepPartial that selects a layout preset: its rows plus any preset-specific
 * overrides (re-centring origin, wider frustum, faded structural keys). The single
 * source of truth shared by the URL parser (`?layout=`) and the app's default
 * opening layout (see js/main.ts). Returns `{}` for an unknown preset.
 */
export function layoutPreset(preset: string): DeepPartial<OpenKeysConfig> {
  const rows = LAYOUT_PRESETS[preset];
  if (!rows) return {};
  const override = LAYOUT_OVERRIDES[preset] || {};
  const out: DeepPartial<OpenKeysConfig> = {
    layout: { ...(override.layout || {}), rows, preset: preset as LayoutConfig['preset'] },
  };
  if (override.camera) out.camera = override.camera;
  return out;
}

const LIGHT_THEME: ThemeColors = {
  background: '#fcfaf6',
  floor: '#ffffff',
  keyTop: '#fcfaf6',
  keySide: '#cccccc',
  keyText: '#3c4142',
  outline: '#3c4142',
  outlineOpacity: 0.6,
  // Base outline matches the key edge outline so the footprint reads as one of
  // the key's edges, not a fainter, separate shape.
  baseOutline: '#3c4142',
  baseOutlineOpacity: 0.6,
};

const DARK_THEME: ThemeColors = {
  background: '#000000',
  floor: '#3c4142',
  keyTop: '#252525',
  keySide: '#333333',
  keyText: '#fcfaf6',
  outline: '#fcfaf6',
  outlineOpacity: 0.8,
  // Base outline matches the key edge outline (see LIGHT_THEME note).
  baseOutline: '#fcfaf6',
  baseOutlineOpacity: 0.8,
};

/** The original behavior, expressed as data. Empty config === this. */
export const defaultConfig: OpenKeysConfig = {
  text: '',

  layout: {
    rows: QWERTY_ROWS,
    keySize: 10,
    spacing: 12,
    rowStagger: 5,
    keyGap: 2,
    // A subtle resting raise so the empty/cleared board reads as a real 3D
    // keyboard (not flat squares on the floor) — the state a first-time visitor
    // lands on after the opening reveal. Both match so every key rests at the same
    // level; data keys still rise further from here as you type.
    structuralKeyHeight: 0.2,
    mainKeyHeight: 0.2,
    preset: 'qwerty',
  },

  data: {
    mode: 'frequency',
    growthIncrement: 0.5,
    maxKeyHeight: 4,
    caseSensitive: false,
    includeChars: /[a-z0-9]/,
  },

  theme: {
    mode: 'light',
    light: LIGHT_THEME,
    dark: DARK_THEME,
  },

  typography: {
    keyCapFonts: [
      { name: 'System', url: `${ASSET_BASE}fonts/helvetiker_regular.typeface.json` },
      { name: 'Georgia', url: `${ASSET_BASE}fonts/gentilis_regular.typeface.json` },
      { name: 'Inter', url: `${ASSET_BASE}fonts/helvetiker_regular.typeface.json` },
      { name: 'Roboto Condensed', url: `${ASSET_BASE}fonts/helvetiker_regular.typeface.json` },
    ],
    defaultFont: 'System',
    textSize: 3.3,
    curveSegments: 12,
    labelAnchor: 'top',
    labelWeight: 1.05,
  },

  camera: {
    projection: 'perspective',
    // Depth planes tuned for the real view distance (~643u to target; board corners
    // ~580–735u). The board lives far from the camera, so perspective depth precision
    // is dominated by `near`: a low near (the old 1) starves the far region and the
    // engraved letters / key edges z-fight (shimmer). Raising near to 50 lifts the
    // resolvable depth gap at the board from ~0.025u to ~0.0005u — well under the
    // letter/edge separation — killing the flicker. `far` brackets the board plus
    // dolly-out headroom (see controls.maxDistance). Both planes are guarded by the
    // dolly fence below so zoom can't push geometry past them.
    near: 50,
    far: 2800,
    frustum: { mobile: 45, desktop: 80 },
    fov: 15,
    // Desktop opening eye placement — baked from the tuned default view (orbit
    // azimuth ≈ -0.82 rad, polar 60°, ~643u from the target), with lookAt matching
    // the controls target so the first frame is already centred before OrbitControls
    // takes over. Mobile is left at its original placement (not separately tuned).
    position: { mobile: [-45, 45, 45], desktop: [-400.29, 341.33, 381.45] },
    lookAt: { mobile: [0, 20, 0], desktop: [5, 20, 0] },
    controls: {
      target: [5, 20, 0],
      enableRotate: true,
      enableZoom: true,
      enablePan: false,
      enableDamping: true,
      dampingFactor: 0.05,
      rotateSpeed: 1,
      zoomSpeed: 1,
      minPolarAngle: Math.PI / 5,
      maxPolarAngle: Math.PI / 3,
      minAzimuthAngle: -Infinity,
      maxAzimuthAngle: Infinity,
      minZoom: 0.8,
      maxZoom: 1.5,
      // Perspective dolly fence (world units to target). Default view sits at ~643u;
      // these allow ~3× in/out while keeping the board between near (50) and far
      // (2800): nearest geometry at minDistance stays well beyond near, and
      // maxDistance + the board half-extent stays inside far.
      minDistance: 200,
      maxDistance: 2200,
      autoRotate: false, // off: the constant spin made thin outlines/specular shimmer (no temporal AA). Intro spin + user orbit remain. Re-enable only alongside motion AA.
      autoRotateSpeed: 2,
    },
  },

  lights: {
    ambient: { color: '#ffffff', intensity: 0.6 },
    key: { color: '#ffffff', intensity: 2.0, position: [100, 200, 100] },
    fill: { color: '#ffffff', intensity: 0.8, position: [-100, 150, -100] },
    back: { color: '#ffffff', intensity: 0.4, position: [0, 100, -150] },
    rim: { color: '#ffffff', intensity: 0.5, position: [0, -50, 100] },
    keyOrbit: { radius: 250, height: 200 },
    shadowMapSize: 4096,
  },

  scene: {
    pixelRatioCap: 2,
    antialias: true,
    toneMappingExposure: 1.2,
    preserveDrawingBuffer: true,
    mobileBreakpoint: 480,
    environment: { enabled: false, url: undefined },
    floor: { enabled: true, size: 20000, halftone: true },
    boundary: { enabled: true, gap: 3, radius: 2, opacity: 0.15, height: 3, thickness: 1.5 },
  },

  animation: {
    intro: { enabled: true, duration: 2000, pause: 3000 },
    idle: { enabled: true, amplitude: 0.1, speed: 0.03, flow: 0.1, structural: true },
    wave: { speed: 2, radius: 3, height: 0.2 },
    typing: { enabled: true },
    keyPressDepth: 0.3,
  },

  appearance: {
    faceOpacity: 1,
    wallOpacity: 1,
    outlineOpacity: 0.4,
    textOpacity: 0.9,
    extraFaceOpacity: 1,
    extraWallOpacity: 1,
    extraOutlineOpacity: 0.25,
    extraTextOpacity: 1,
  },

  cursor: {
    thickness: 0.085, // em — slim block caret
    rounding: 0.35, // gently rounded, not a capsule blob
  },

  branding: {
    title: 'OpenKeys',
    showNavbar: true,
    posterFilenamePrefix: 'openkeys',
  },

  features: {
    poster: true,
    settingsPanel: true,
    fontDrawer: false, // cycle-only by default; opt into the catalog drawer in settings
    themeToggle: true,
    textInput: true,
    characterBar: true,
    typingSpeed: true,
    sound: true,
    hoverHighlight: true,
    maxCharacters: 90,
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof RegExp)
  );
}

/** Deep-merge `source` onto a clone of `base`. Arrays/RegExps/functions replace wholesale. */
function deepMerge<T>(base: T, source: any): T {
  if (source === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(source)) {
    return source as T;
  }
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv === undefined) continue;
    out[key] = isPlainObject(sv) && isPlainObject(out[key]) ? deepMerge(out[key], sv) : sv;
  }
  return out;
}

/**
 * Parse a whitelisted, type-coerced subset of config from URL query params.
 * Only safe, primitive keys are accepted here — never arbitrary object injection.
 *
 *   ?text= , ?layout=qwerty|azerty|dvorak|numpad|full , ?theme=light|dark|<preset>
 *   ?data=frequency|static , ?font=<name> , ?intro=0|1 , ?poster=0|1 , ?panel=0|1
 *   ?keyfade=0..1 (overall opacity for structural / non-data keys)
 *   ?faces= , ?edges= , ?labels= (main-key per-channel opacity, 0..1)
 *   ?efaces= , ?eedges= , ?elabels= (extra-key per-channel opacity, 0..1)
 *   ?idle=0|1 , ?idleamp= , ?idlespd= , ?idleflow= (idle animation)
 */
export function parseUrlParams(params: URLSearchParams): DeepPartial<OpenKeysConfig> {
  const out: DeepPartial<OpenKeysConfig> = {};

  const text = params.get('text');
  if (text !== null) out.text = text;

  const layout = params.get('layout');
  if (layout && LAYOUT_PRESETS[layout]) {
    Object.assign(out, layoutPreset(layout));
  }

  // Live opacity override for structural (non-data) keys, e.g. ?keyfade=0.2
  const keyfade = params.get('keyfade');
  if (keyfade !== null) {
    const v = Number(keyfade);
    if (!Number.isNaN(v) && v >= 0 && v <= 1) {
      out.layout = { ...(out.layout || {}), structuralKeyOpacity: v };
    }
  }

  // Resting height for structural keys, e.g. ?skh=0.6 (0–5)
  const skh = params.get('skh');
  if (skh !== null) {
    const v = Number(skh);
    if (!Number.isNaN(v) && v >= 0 && v <= 5) {
      out.layout = { ...(out.layout || {}), structuralKeyHeight: v };
    }
  }

  // Starting/resting height for the data (main 36) keys, e.g. ?mkh=0.6 (0–5)
  const mkh = params.get('mkh');
  if (mkh !== null) {
    const v = Number(mkh);
    if (!Number.isNaN(v) && v >= 0 && v <= 5) {
      out.layout = { ...(out.layout || {}), mainKeyHeight: v };
    }
  }

  // Per-channel opacity multipliers. Data (main) keys: ?faces=&edges=&labels=
  // Structural (extra) keys: ?efaces=&eedges=&elabels=  (each 0–1)
  const appearance: Partial<AppearanceConfig> = {};
  const op01 = (raw: string | null): number | undefined => {
    if (raw === null) return undefined;
    const v = Number(raw);
    return !Number.isNaN(v) && v >= 0 && v <= 1 ? v : undefined;
  };
  const faces = op01(params.get('faces'));
  if (faces !== undefined) appearance.faceOpacity = faces;
  const walls = op01(params.get('walls'));
  if (walls !== undefined) appearance.wallOpacity = walls;
  const edges = op01(params.get('edges'));
  if (edges !== undefined) appearance.outlineOpacity = edges;
  const labels = op01(params.get('labels'));
  if (labels !== undefined) appearance.textOpacity = labels;
  const efaces = op01(params.get('efaces'));
  if (efaces !== undefined) appearance.extraFaceOpacity = efaces;
  const ewalls = op01(params.get('ewalls'));
  if (ewalls !== undefined) appearance.extraWallOpacity = ewalls;
  const eedges = op01(params.get('eedges'));
  if (eedges !== undefined) appearance.extraOutlineOpacity = eedges;
  const elabels = op01(params.get('elabels'));
  if (elabels !== undefined) appearance.extraTextOpacity = elabels;
  if (Object.keys(appearance).length) out.appearance = appearance;

  // Cursor (typing caret): ?cursorw= thickness in em (0.02–0.3), ?cursorr= rounding (0–1)
  const cursor: Partial<CursorConfig> = {};
  const cw = params.get('cursorw');
  if (cw !== null) {
    const v = Number(cw);
    if (!Number.isNaN(v) && v >= 0.02 && v <= 0.3) cursor.thickness = v;
  }
  const cr = op01(params.get('cursorr'));
  if (cr !== undefined) cursor.rounding = cr;
  if (Object.keys(cursor).length) out.cursor = cursor;

  // Idle "breathing" animation, e.g. ?idle=0|1&idleamp=0.1&idlespd=0.03&idleflow=0.1
  const idle: Partial<AnimationConfig['idle']> = {};
  const num = (raw: string | null, max: number): number | undefined => {
    if (raw === null) return undefined;
    const v = Number(raw);
    return !Number.isNaN(v) && v >= 0 && v <= max ? v : undefined;
  };
  const idleOn = params.get('idle');
  if (idleOn === '0' || idleOn === '1') idle.enabled = idleOn === '1';
  const idleAmp = num(params.get('idleamp'), 1);
  if (idleAmp !== undefined) idle.amplitude = idleAmp;
  const idleSpd = num(params.get('idlespd'), 1);
  if (idleSpd !== undefined) idle.speed = idleSpd;
  const idleFlow = num(params.get('idleflow'), 1);
  if (idleFlow !== undefined) idle.flow = idleFlow;
  const idleStruct = params.get('idlestruct');
  if (idleStruct === '0' || idleStruct === '1') idle.structural = idleStruct === '1';
  if (Object.keys(idle).length) out.animation = { idle };

  const theme = params.get('theme');
  if (theme === 'light' || theme === 'dark') {
    out.theme = { mode: theme };
  }

  const data = params.get('data');
  if (data === 'frequency' || data === 'static') {
    out.data = { mode: data };
  }
  // Key-height tuning: ?rise= (per-tap rise, 0–3) and ?maxh= (composition ceiling, 0–20)
  const rise = num(params.get('rise'), 3);
  if (rise !== undefined) out.data = { ...(out.data || {}), growthIncrement: rise };
  const maxh = num(params.get('maxh'), 20);
  if (maxh !== undefined) out.data = { ...(out.data || {}), maxKeyHeight: maxh };

  // Keycap typography (merged into one object so params don't clobber each other).
  const font = params.get('font');
  const textsize = num(params.get('textsize'), 6);
  const labelweight = num(params.get('labelweight'), 2);
  const labelposRaw = params.get('labelpos');
  const ANCHORS: LabelAnchor[] = [
    'center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right',
  ];
  const labelpos = labelposRaw && (ANCHORS as string[]).includes(labelposRaw) ? (labelposRaw as LabelAnchor) : undefined;
  const typo: DeepPartial<TypographyConfig> = {};
  if (font) typo.defaultFont = font;
  if (textsize !== undefined) typo.textSize = textsize;
  if (labelweight !== undefined) typo.labelWeight = labelweight;
  if (labelpos) typo.labelAnchor = labelpos;
  if (Object.keys(typo).length) out.typography = typo;

  // Camera projection + perspective FOV, e.g. ?projection=perspective&fov=50
  const projection = params.get('projection');
  if (projection === 'orthographic' || projection === 'perspective') {
    out.camera = { ...(out.camera || {}), projection };
  }
  const fov = num(params.get('fov'), 120);
  if (fov !== undefined) out.camera = { ...(out.camera || {}), fov };

  const intro = params.get('intro');
  if (intro === '0' || intro === '1') {
    out.animation = { intro: { enabled: intro === '1' } };
  }

  const poster = params.get('poster');
  if (poster === '0' || poster === '1') {
    out.features = { ...(out.features || {}), poster: poster === '1' };
  }

  const panel = params.get('panel');
  if (panel === '0' || panel === '1') {
    out.features = { ...(out.features || {}), settingsPanel: panel === '1' };
  }

  const sound = params.get('sound');
  if (sound === '0' || sound === '1') {
    out.features = { ...(out.features || {}), sound: sound === '1' };
  }

  return out;
}

/**
 * Resolve the effective config.
 * Precedence (lowest -> highest): defaultConfig < partial < whitelisted URL params.
 */
export function resolveConfig(
  partial: DeepPartial<OpenKeysConfig> = {},
  urlParams?: URLSearchParams
): OpenKeysConfig {
  let cfg = deepMerge(defaultConfig, partial);
  if (urlParams) {
    cfg = deepMerge(cfg, parseUrlParams(urlParams));
  }
  // Default the Google Fonts API key from the build-time env var when the embedder
  // didn't pass one, so the font-library module can read it off config alone.
  if (!cfg.typography.googleFontsApiKey) {
    const envKey =
      typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_FONTS_API_KEY;
    if (envKey) cfg.typography.googleFontsApiKey = envKey as string;
  }
  return cfg;
}
