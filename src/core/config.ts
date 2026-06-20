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

export interface LayoutConfig {
  /** Grid of labels. Default = QWERTY. Any grid works (azerty, dvorak, numpad, custom). */
  rows: string[][];
  /** Cube edge length for each key. */
  keySize: number;
  /** Z distance between rows. */
  spacing: number;
  /** Per-row horizontal stagger multiplier (row index * this many units). Classic keyboard = 5. */
  rowStagger: number;
  /** Horizontal gap added between keys within a row. */
  keyGap: number;
  /** Named preset, for the settings UI. */
  preset?: 'qwerty' | 'azerty' | 'dvorak' | 'numpad' | 'custom';
}

export interface DataConfig {
  /**
   * What drives key height:
   *  - 'frequency' : count how often each label appears in `text` (classic behavior)
   *  - 'static'    : use `staticValues` directly
   *  - 'custom'    : call `valueFn(label, text, counts)`
   */
  mode: DataMode;
  /** Height per unit of value. height = growthIncrement * value. */
  growthIncrement: number;
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

export interface TypographyConfig {
  /** 3D key-cap typefaces (three.js typeface.json). */
  keyCapFonts: KeyCapFont[];
  /** Name of the key-cap font used at startup (must match one of keyCapFonts). */
  defaultFont: string;
  /** Engraved glyph size. */
  textSize: number;
  /** Curve smoothness for the engraved glyphs. */
  curveSegments: number;
  /** Optional Google Fonts API key. When absent the font drawer degrades gracefully. */
  googleFontsApiKey?: string;
}

export interface CameraConfig {
  near: number;
  far: number;
  /** Orthographic frustum half-size, per breakpoint. */
  frustum: { mobile: number; desktop: number };
  position: { mobile: Vec3; desktop: Vec3 };
  lookAt: { mobile: Vec3; desktop: Vec3 };
  controls: {
    target: Vec3;
    dampingFactor: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    minZoom: number;
    maxZoom: number;
    enablePan: boolean;
  };
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
}

export interface AnimationConfig {
  intro: { enabled: boolean; duration: number; pause: number };
  idle: { enabled: boolean; amplitude: number; speed: number };
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
  fontDrawer: boolean;
  themeToggle: boolean;
  /** Editable text input + type-anywhere. */
  textInput: boolean;
  /** Per-letter frequency bar. */
  characterBar: boolean;
  /** Live words-per-minute readout. */
  typingSpeed: boolean;
  maxCharacters: number;
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

export const LAYOUT_PRESETS: Record<string, string[][]> = {
  qwerty: QWERTY_ROWS,
  azerty: AZERTY_ROWS,
  dvorak: DVORAK_ROWS,
  numpad: NUMPAD_ROWS,
};

const LIGHT_THEME: ThemeColors = {
  background: '#fcfaf6',
  floor: '#ffffff',
  keyTop: '#fcfaf6',
  keySide: '#cccccc',
  keyText: '#3c4142',
  outline: '#3c4142',
  outlineOpacity: 0.6,
  baseOutline: '#3c4142',
  baseOutlineOpacity: 0.4,
};

const DARK_THEME: ThemeColors = {
  background: '#000000',
  floor: '#3c4142',
  keyTop: '#252525',
  keySide: '#333333',
  keyText: '#fcfaf6',
  outline: '#fcfaf6',
  outlineOpacity: 0.8,
  baseOutline: '#ffffff',
  baseOutlineOpacity: 0.6,
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
    preset: 'qwerty',
  },

  data: {
    mode: 'frequency',
    growthIncrement: 0.5,
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
    textSize: 2.5,
    curveSegments: 12,
  },

  camera: {
    near: 1,
    far: 1000,
    frustum: { mobile: 45, desktop: 80 },
    position: { mobile: [-45, 45, 45], desktop: [-80, 80, 80] },
    lookAt: { mobile: [0, 20, 0], desktop: [0, 35, 0] },
    controls: {
      target: [5, 20, 0],
      dampingFactor: 0.05,
      minPolarAngle: Math.PI / 5,
      maxPolarAngle: Math.PI / 3,
      minZoom: 0.8,
      maxZoom: 1.5,
      enablePan: false,
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
  },

  animation: {
    intro: { enabled: true, duration: 2000, pause: 3000 },
    idle: { enabled: true, amplitude: 0.1, speed: 0.03 },
    wave: { speed: 2, radius: 3, height: 0.2 },
    typing: { enabled: true },
    keyPressDepth: 0.3,
  },

  branding: {
    title: 'OpenKeys',
    showNavbar: true,
    posterFilenamePrefix: 'openkeys',
  },

  features: {
    poster: true,
    settingsPanel: true,
    fontDrawer: true,
    themeToggle: true,
    textInput: true,
    characterBar: true,
    typingSpeed: true,
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
 *   ?text= , ?layout=qwerty|azerty|dvorak|numpad , ?theme=light|dark|<preset>
 *   ?data=frequency|static , ?font=<name> , ?intro=0|1 , ?poster=0|1 , ?panel=0|1
 */
export function parseUrlParams(params: URLSearchParams): DeepPartial<OpenKeysConfig> {
  const out: DeepPartial<OpenKeysConfig> = {};

  const text = params.get('text');
  if (text !== null) out.text = text;

  const layout = params.get('layout');
  if (layout && LAYOUT_PRESETS[layout]) {
    out.layout = { rows: LAYOUT_PRESETS[layout], preset: layout as LayoutConfig['preset'] };
  }

  const theme = params.get('theme');
  if (theme === 'light' || theme === 'dark') {
    out.theme = { mode: theme };
  }

  const data = params.get('data');
  if (data === 'frequency' || data === 'static') {
    out.data = { mode: data };
  }

  const font = params.get('font');
  if (font) out.typography = { defaultFont: font };

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
  return cfg;
}
