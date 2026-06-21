/**
 * settings-panel — the gear-button slide-over: keyboard layout, theme, intro
 * animation, poster-button visibility, and a "copy shareable link" action that
 * encodes the current state into a URL.
 *
 * Structural changes (layout, intro) reload the page with the text preserved in
 * the URL; live changes (theme, poster visibility) go straight through the engine.
 */
import type { OpenKeysModule } from '../../core/types';
import { showToast } from '../../shared/toast';
import './style.css';

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return (
    host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) ||
    host.querySelector<HTMLElement>(`#${id}`)
  );
}

export const settingsPanel: OpenKeysModule = ({ engine, host, signal }) => {
  const toggle = resolve(host, 'settings-toggle', 'settingsToggle');
  if (!engine.config.features.settingsPanel) {
    toggle?.classList.add('hidden');
    return () => {}; // nothing wired when the settings panel is disabled
  }

  let panel: HTMLElement | null = null;
  const offs: Array<() => void> = [];

  /** "Starting height" link state: when true, one slider drives both key groups.
     Seeded from config — linked only if the two heights already match. */
  let heightLinked =
    (engine.config.layout.mainKeyHeight ?? 0) === (engine.config.layout.structuralKeyHeight ?? 0);

  /** Does the active layout contain structural (non-data) keys to fade? */
  const hasStructuralKeys = () =>
    engine.config.layout.rows.some((row) =>
      row.some((cell) => typeof cell !== 'string' && cell.typeable === false)
    );

  /** Build a shareable URL that reproduces the current configuration. */
  const buildShareUrl = (overrides: Record<string, string> = {}): string => {
    const params = new URLSearchParams();
    const { config } = engine;
    if (engine.currentText) params.set('text', engine.currentText);
    // Always pin the layout — the app's default is no longer QWERTY, so an absent
    // param can't be assumed to mean QWERTY.
    if (config.layout.preset) params.set('layout', config.layout.preset);
    // Pin the structural-key opacity + resting height so reloads/links reproduce them.
    if (hasStructuralKeys() && config.layout.structuralKeyOpacity != null) {
      params.set('keyfade', String(config.layout.structuralKeyOpacity));
    }
    if (hasStructuralKeys() && config.layout.structuralKeyHeight != null) {
      params.set('skh', String(config.layout.structuralKeyHeight));
    }
    if (config.layout.mainKeyHeight) params.set('mkh', String(config.layout.mainKeyHeight));
    // Pin key-growth tuning when it differs from defaults.
    if (config.data.growthIncrement !== 0.5) params.set('rise', String(config.data.growthIncrement));
    if (config.data.maxKeyHeight != null && config.data.maxKeyHeight !== 4) {
      params.set('maxh', String(config.data.maxKeyHeight));
    }
    // Pin cursor thickness/rounding when non-default.
    if (config.cursor && config.cursor.thickness !== 0.105) params.set('cursorw', String(config.cursor.thickness));
    if (config.cursor && config.cursor.rounding !== 0.35) params.set('cursorr', String(config.cursor.rounding));
    // Keycap label typography (size / placement / weight) when non-default.
    const ty = config.typography;
    if (ty.textSize !== 2.5) params.set('textsize', String(ty.textSize));
    if (ty.labelAnchor && ty.labelAnchor !== 'center') params.set('labelpos', ty.labelAnchor);
    if ((ty.labelWeight ?? 1) !== 1) params.set('labelweight', String(ty.labelWeight));
    // Pin the per-channel opacity multipliers when they differ from the default (1).
    const ap = config.appearance;
    if (ap.faceOpacity !== 1) params.set('faces', String(ap.faceOpacity));
    if (ap.wallOpacity !== 1) params.set('walls', String(ap.wallOpacity));
    if (ap.outlineOpacity !== 1) params.set('edges', String(ap.outlineOpacity));
    if (ap.textOpacity !== 1) params.set('labels', String(ap.textOpacity));
    if (hasStructuralKeys()) {
      if (ap.extraFaceOpacity !== 1) params.set('efaces', String(ap.extraFaceOpacity));
      if (ap.extraWallOpacity !== 1) params.set('ewalls', String(ap.extraWallOpacity));
      if (ap.extraOutlineOpacity !== 1) params.set('eedges', String(ap.extraOutlineOpacity));
      if (ap.extraTextOpacity !== 1) params.set('elabels', String(ap.extraTextOpacity));
    }
    // Pin idle-animation params when they differ from defaults.
    const idle = config.animation.idle;
    if (!idle.enabled) params.set('idle', '0');
    if (idle.amplitude !== 0.1) params.set('idleamp', String(idle.amplitude));
    if (idle.speed !== 0.03) params.set('idlespd', String(idle.speed));
    if (idle.flow !== 0.1) params.set('idleflow', String(idle.flow));
    if (idle.structural) params.set('idlestruct', '1');
    // Camera projection (+ perspective FOV when it differs from the default).
    if (config.camera.projection !== 'orthographic') {
      params.set('projection', config.camera.projection);
      if (config.camera.fov !== 50) params.set('fov', String(config.camera.fov));
    }
    params.set('theme', engine.themeMode);
    if (!config.animation.intro.enabled) params.set('intro', '0');
    if (!config.features.poster) params.set('poster', '0');
    if (!config.features.sound) params.set('sound', '0');
    for (const [k, v] of Object.entries(overrides)) {
      if (v === '' || v == null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return `${location.origin}${location.pathname}${qs ? '?' + qs : ''}`;
  };

  const syncThemeSegment = () => {
    panel?.querySelectorAll<HTMLElement>('#settingsTheme button').forEach((el) => {
      el.classList.toggle('active', el.dataset.theme === engine.themeMode);
    });
  };

  const reflectConfig = () => {
    if (!panel) return;
    const { config } = engine;
    const layoutSel = panel.querySelector<HTMLSelectElement>('#settingsLayout');
    if (layoutSel) layoutSel.value = config.layout.preset || 'qwerty';
    const introChk = panel.querySelector<HTMLInputElement>('#settingsIntro');
    if (introChk) introChk.checked = config.animation.intro.enabled;
    const posterChk = panel.querySelector<HTMLInputElement>('#settingsPoster');
    if (posterChk) posterChk.checked = config.features.poster;
    const fontDrawerChk = panel.querySelector<HTMLInputElement>('#settingsFontDrawer');
    if (fontDrawerChk) fontDrawerChk.checked = config.features.fontDrawer;
    const hoverChk = panel.querySelector<HTMLInputElement>('#settingsHoverHighlight');
    if (hoverChk) hoverChk.checked = config.features.hoverHighlight;
    const soundChk = panel.querySelector<HTMLInputElement>('#settingsSound');
    if (soundChk) soundChk.checked = config.features.sound;
    const boundaryChk = panel.querySelector<HTMLInputElement>('#settingsBoundary');
    if (boundaryChk) boundaryChk.checked = config.scene.boundary.enabled;
    reflectRange('#settingsBoundaryGap', '#settingsBoundaryGapVal', config.scene.boundary.gap, (v) => String(Math.round(v)));
    reflectRange('#settingsBoundaryRadius', '#settingsBoundaryRadiusVal', config.scene.boundary.radius, (v) => String(Math.round(v)));
    reflectRange('#settingsBoundaryOpacity', '#settingsBoundaryOpacityVal', config.scene.boundary.opacity);
    reflectRange('#settingsBoundaryHeight', '#settingsBoundaryHeightVal', config.scene.boundary.height, (v) => v.toFixed(1));
    reflectRange('#settingsBoundaryThickness', '#settingsBoundaryThicknessVal', config.scene.boundary.thickness, (v) => v.toFixed(1));

    // The whole "Extra keys" group is only meaningful when the layout has them.
    const showExtra = hasStructuralKeys();
    panel.querySelectorAll<HTMLElement>('.settings-extra-only').forEach((el) => {
      el.hidden = !showExtra;
    });

    // Keycap labels — size / placement / weight.
    reflectRange('#settingsTextSize', '#settingsTextSizeVal', config.typography.textSize, oneDec);
    reflectRange('#settingsLabelWeight', '#settingsLabelWeightVal', config.typography.labelWeight ?? 1, oneDec);
    const labelAnchorSel = panel.querySelector<HTMLSelectElement>('#settingsLabelAnchor');
    if (labelAnchorSel) labelAnchorSel.value = config.typography.labelAnchor ?? 'center';

    // Main-key per-channel opacity.
    const ap = config.appearance;
    reflectRange('#settingsFaceOp', '#settingsFaceOpVal', ap.faceOpacity);
    reflectRange('#settingsWallOp', '#settingsWallOpVal', ap.wallOpacity);
    reflectRange('#settingsOutlineOp', '#settingsOutlineOpVal', ap.outlineOpacity);
    reflectRange('#settingsTextOp', '#settingsTextOpVal', ap.textOpacity);

    // Starting height — link toggle + combined/separate sliders.
    const linkChk = panel.querySelector<HTMLInputElement>('#settingsHeightLink');
    if (linkChk) linkChk.checked = heightLinked;
    const mainH = config.layout.mainKeyHeight ?? 0;
    const extraH = config.layout.structuralKeyHeight ?? 0;
    // Combined slider when there are no extra keys, or when the two are linked.
    const combinedHeight = !showExtra || heightLinked;
    const setHidden = (sel: string, hidden: boolean) => {
      const el = panel?.querySelector<HTMLElement>(sel);
      if (el) el.hidden = hidden;
    };
    setHidden('#settingsHeightAllField', !combinedHeight);
    setHidden('#settingsHeightMainField', combinedHeight);
    setHidden('#settingsHeightExtraField', combinedHeight || !showExtra);
    reflectRange('#settingsHeightAll', '#settingsHeightAllVal', mainH, dec);
    reflectRange('#settingsHeightMain', '#settingsHeightMainVal', mainH, dec);
    reflectRange('#settingsHeightExtra', '#settingsHeightExtraVal', extraH, dec);

    // Key growth: per-tap rise + composition ceiling.
    reflectRange('#settingsRise', '#settingsRiseVal', config.data.growthIncrement, dec);
    reflectRange('#settingsMaxHeight', '#settingsMaxHeightVal', config.data.maxKeyHeight ?? 0, oneDec);
    reflectRange('#settingsCursorThickness', '#settingsCursorThicknessVal', config.cursor?.thickness ?? 0.105, dec);
    reflectRange('#settingsCursorRounding', '#settingsCursorRoundingVal', config.cursor?.rounding ?? 0.35);

    // Extra-key idle toggle + overall fade + per-channel opacity.
    const extraIdleChk = panel.querySelector<HTMLInputElement>('#settingsExtraIdle');
    if (extraIdleChk) extraIdleChk.checked = config.animation.idle.structural ?? false;
    reflectRange('#settingsOpacity', '#settingsOpacityVal', config.layout.structuralKeyOpacity ?? 1);
    reflectRange('#settingsExtraFace', '#settingsExtraFaceVal', ap.extraFaceOpacity);
    reflectRange('#settingsExtraWall', '#settingsExtraWallVal', ap.extraWallOpacity);
    reflectRange('#settingsExtraOutline', '#settingsExtraOutlineVal', ap.extraOutlineOpacity);
    reflectRange('#settingsExtraText', '#settingsExtraTextVal', ap.extraTextOpacity);

    // Idle animation.
    const idleChk = panel.querySelector<HTMLInputElement>('#settingsIdle');
    if (idleChk) idleChk.checked = config.animation.idle.enabled;
    reflectRange('#settingsIdleAmp', '#settingsIdleAmpVal', config.animation.idle.amplitude, dec);
    reflectRange('#settingsIdleSpd', '#settingsIdleSpdVal', config.animation.idle.speed, dec);
    reflectRange('#settingsIdleFlow', '#settingsIdleFlowVal', config.animation.idle.flow, dec);

    // Camera & orbit.
    const cc = config.camera.controls;
    const setChecked = (sel: string, on: boolean) => {
      const el = panel?.querySelector<HTMLInputElement>(sel);
      if (el) el.checked = on;
    };
    // Projection + FOV (FOV only meaningful for perspective).
    const projSel = panel.querySelector<HTMLSelectElement>('#settingsProjection');
    if (projSel) projSel.value = config.camera.projection;
    const fovField = panel.querySelector<HTMLElement>('#settingsFovField');
    if (fovField) fovField.hidden = config.camera.projection !== 'perspective';
    reflectRange('#settingsFov', '#settingsFovVal', config.camera.fov, degFmt);
    setChecked('#settingsRotate', cc.enableRotate);
    setChecked('#settingsZoomEnable', cc.enableZoom);
    setChecked('#settingsPan', cc.enablePan);
    reflectRange('#settingsPolarMin', '#settingsPolarMinVal', Math.round(toDeg(cc.minPolarAngle)), degFmt);
    reflectRange('#settingsPolarMax', '#settingsPolarMaxVal', Math.round(toDeg(cc.maxPolarAngle)), degFmt);
    reflectRange('#settingsZoomMin', '#settingsZoomMinVal', cc.minZoom, dec);
    reflectRange('#settingsZoomMax', '#settingsZoomMaxVal', cc.maxZoom, dec);
    reflectRange('#settingsDamping', '#settingsDampingVal', cc.dampingFactor, dec);
    setChecked('#settingsAuto', cc.autoRotate);
    const autoField = panel.querySelector<HTMLElement>('#settingsAutoSpeedField');
    if (autoField) autoField.hidden = !cc.autoRotate;
    reflectRange('#settingsAutoSpeed', '#settingsAutoSpeedVal', cc.autoRotateSpeed, oneDec);
    // Horizontal fence: limited when the azimuth max is finite.
    const azLimited = Number.isFinite(cc.maxAzimuthAngle);
    setChecked('#settingsAzLimit', azLimited);
    const azField = panel.querySelector<HTMLElement>('#settingsAzRangeField');
    if (azField) azField.hidden = !azLimited;
    reflectRange(
      '#settingsAzRange',
      '#settingsAzRangeVal',
      azLimited ? Math.round(toDeg(cc.maxAzimuthAngle)) : 90,
      degFmt
    );
  };

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const dec = (v: number) => v.toFixed(2);
  const oneDec = (v: number) => v.toFixed(1);
  const degFmt = (v: number) => `${Math.round(v)}°`;
  const RAD = Math.PI / 180;
  const toDeg = (rad: number) => rad * (180 / Math.PI);

  /** Sync one range input + its readout to a value (formatter defaults to %). */
  const reflectRange = (
    sliderSel: string,
    valSel: string,
    v: number,
    fmt: (v: number) => string = pct
  ) => {
    const slider = panel?.querySelector<HTMLInputElement>(sliderSel);
    if (slider) slider.value = String(v);
    const val = panel?.querySelector<HTMLElement>(valSel);
    if (val) val.textContent = fmt(v);
  };

  /** Wire a range input to a live engine setter, updating its readout. */
  const wireRange = (
    sliderSel: string,
    valSel: string,
    apply: (v: number) => void,
    fmt: (v: number) => string = pct
  ) => {
    const slider = panel?.querySelector<HTMLInputElement>(sliderSel);
    const val = panel?.querySelector<HTMLElement>(valSel);
    slider?.addEventListener(
      'input',
      () => {
        const v = Number(slider.value);
        apply(v);
        if (val) val.textContent = fmt(v);
      },
      { signal }
    );
  };

  /** Wire a checkbox toggle to a live engine setter (called with the checked state). */
  const wireToggle = (sel: string, apply: (checked: boolean) => void) => {
    const chk = panel?.querySelector<HTMLInputElement>(sel);
    chk?.addEventListener('change', () => apply(chk.checked), { signal });
  };

  const build = () => {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.className = 'settings-panel';
    panel.innerHTML = `
      <div class="settings-header">
        <span>Settings</span>
        <button id="settingsClose" class="settings-close" aria-label="Close settings">×</button>
      </div>
      <label class="settings-field">
        <span>Keyboard layout</span>
        <select id="settingsLayout">
          <option value="qwerty">QWERTY</option>
          <option value="azerty">AZERTY</option>
          <option value="dvorak">Dvorak</option>
          <option value="numpad">Numpad</option>
          <option value="full">Full (Mac) — experimental</option>
        </select>
      </label>

      <div class="settings-section">Starting height</div>
      <label class="settings-check settings-extra-only" id="settingsHeightLinkField">
        <span>Link main &amp; extra</span>
        <input type="checkbox" id="settingsHeightLink" />
        <span class="settings-switch" aria-hidden="true"></span>
      </label>
      <label class="settings-field settings-range" id="settingsHeightAllField">
        <span>Starting height <em id="settingsHeightAllVal">0.00</em></span>
        <input type="range" id="settingsHeightAll" min="0" max="2" step="0.05" />
      </label>
      <label class="settings-field settings-range" id="settingsHeightMainField">
        <span>Main keys <em id="settingsHeightMainVal">0.00</em></span>
        <input type="range" id="settingsHeightMain" min="0" max="2" step="0.05" />
      </label>
      <label class="settings-field settings-range" id="settingsHeightExtraField">
        <span>Extra keys <em id="settingsHeightExtraVal">0.60</em></span>
        <input type="range" id="settingsHeightExtra" min="0" max="2" step="0.05" />
      </label>

      <div class="settings-section">Key growth</div>
      <label class="settings-field settings-range">
        <span>Rise per tap <em id="settingsRiseVal">0.50</em></span>
        <input type="range" id="settingsRise" min="0.05" max="1.5" step="0.05" />
      </label>
      <label class="settings-field settings-range">
        <span>Max height <em id="settingsMaxHeightVal">4.0</em></span>
        <input type="range" id="settingsMaxHeight" min="0" max="10" step="0.5" />
      </label>
      <p class="settings-hint">Tallest key auto-scales to fit “Max height” as text grows (0 = uncapped).</p>

      <div class="settings-section">Cursor</div>
      <label class="settings-field settings-range">
        <span>Thickness <em id="settingsCursorThicknessVal">0.11</em></span>
        <input type="range" id="settingsCursorThickness" min="0.04" max="0.2" step="0.005" />
      </label>
      <label class="settings-field settings-range">
        <span>Rounding <em id="settingsCursorRoundingVal">35%</em></span>
        <input type="range" id="settingsCursorRounding" min="0" max="1" step="0.05" />
      </label>

      <div class="settings-section">Keycap labels</div>
      <label class="settings-field settings-range">
        <span>Letter size <em id="settingsTextSizeVal">2.5</em></span>
        <input type="range" id="settingsTextSize" min="1" max="5" step="0.1" />
      </label>
      <label class="settings-field">
        <span>Letter placement</span>
        <select id="settingsLabelAnchor">
          <option value="center">Center</option>
          <option value="top">Top</option>
          <option value="bottom">Bottom</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="top-left">Top left</option>
          <option value="top-right">Top right</option>
          <option value="bottom-left">Bottom left</option>
          <option value="bottom-right">Bottom right</option>
        </select>
      </label>
      <label class="settings-field settings-range">
        <span>Letter weight <em id="settingsLabelWeightVal">1.0</em></span>
        <input type="range" id="settingsLabelWeight" min="1" max="2" step="0.05" />
      </label>

      <div class="settings-section">Main keys</div>
      <label class="settings-field settings-range">
        <span>Face (top) opacity <em id="settingsFaceOpVal">100%</em></span>
        <input type="range" id="settingsFaceOp" min="0" max="1" step="0.05" />
      </label>
      <label class="settings-field settings-range">
        <span>Wall (sides) opacity <em id="settingsWallOpVal">100%</em></span>
        <input type="range" id="settingsWallOp" min="0" max="1" step="0.05" />
      </label>
      <label class="settings-field settings-range">
        <span>Outline opacity <em id="settingsOutlineOpVal">100%</em></span>
        <input type="range" id="settingsOutlineOp" min="0" max="1" step="0.05" />
      </label>
      <label class="settings-field settings-range">
        <span>Text opacity <em id="settingsTextOpVal">100%</em></span>
        <input type="range" id="settingsTextOp" min="0" max="1" step="0.05" />
      </label>

      <div class="settings-section settings-extra-only" id="settingsExtraSection">Extra keys</div>
      <label class="settings-check settings-extra-only">
        <span>Breathe with idle animation</span>
        <input type="checkbox" id="settingsExtraIdle" />
        <span class="settings-switch" aria-hidden="true"></span>
      </label>
      <label class="settings-field settings-range settings-extra-only" id="settingsOpacityField">
        <span>Overall opacity <em id="settingsOpacityVal">35%</em></span>
        <input type="range" id="settingsOpacity" min="0" max="1" step="0.05" />
      </label>
      <label class="settings-field settings-range settings-extra-only">
        <span>Face (top) opacity <em id="settingsExtraFaceVal">100%</em></span>
        <input type="range" id="settingsExtraFace" min="0" max="1" step="0.05" />
      </label>
      <label class="settings-field settings-range settings-extra-only">
        <span>Wall (sides) opacity <em id="settingsExtraWallVal">100%</em></span>
        <input type="range" id="settingsExtraWall" min="0" max="1" step="0.05" />
      </label>
      <label class="settings-field settings-range settings-extra-only">
        <span>Outline opacity <em id="settingsExtraOutlineVal">100%</em></span>
        <input type="range" id="settingsExtraOutline" min="0" max="1" step="0.05" />
      </label>
      <label class="settings-field settings-range settings-extra-only">
        <span>Text opacity <em id="settingsExtraTextVal">100%</em></span>
        <input type="range" id="settingsExtraText" min="0" max="1" step="0.05" />
      </label>
      <div class="settings-field">
        <span>Theme</span>
        <div class="settings-segment" id="settingsTheme" role="group" aria-label="Theme">
          <button type="button" data-theme="light">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/></svg>
            <span>Light</span>
          </button>
          <button type="button" data-theme="dark">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/></svg>
            <span>Dark</span>
          </button>
        </div>
      </div>
      <div class="settings-section">Camera &amp; orbit</div>
      <label class="settings-field">
        <span>Projection</span>
        <select id="settingsProjection">
          <option value="orthographic">Orthographic (parallel)</option>
          <option value="perspective">Perspective</option>
        </select>
      </label>
      <label class="settings-field settings-range" id="settingsFovField">
        <span>Field of view <em id="settingsFovVal">50°</em></span>
        <input type="range" id="settingsFov" min="15" max="90" step="1" />
      </label>
      <label class="settings-check">
        <span>Orbit (rotate)</span>
        <input type="checkbox" id="settingsRotate" />
        <span class="settings-switch" aria-hidden="true"></span>
      </label>
      <label class="settings-field settings-range">
        <span>Vertical angle — min <em id="settingsPolarMinVal">36°</em></span>
        <input type="range" id="settingsPolarMin" min="0" max="90" step="1" />
      </label>
      <label class="settings-field settings-range">
        <span>Vertical angle — max <em id="settingsPolarMaxVal">60°</em></span>
        <input type="range" id="settingsPolarMax" min="0" max="90" step="1" />
      </label>
      <label class="settings-check">
        <span>Limit horizontal rotation</span>
        <input type="checkbox" id="settingsAzLimit" />
        <span class="settings-switch" aria-hidden="true"></span>
      </label>
      <label class="settings-field settings-range" id="settingsAzRangeField">
        <span>Horizontal range ± <em id="settingsAzRangeVal">90°</em></span>
        <input type="range" id="settingsAzRange" min="0" max="180" step="5" />
      </label>
      <label class="settings-check">
        <span>Zoom</span>
        <input type="checkbox" id="settingsZoomEnable" />
        <span class="settings-switch" aria-hidden="true"></span>
      </label>
      <label class="settings-field settings-range">
        <span>Zoom — min <em id="settingsZoomMinVal">0.80</em></span>
        <input type="range" id="settingsZoomMin" min="0.1" max="3" step="0.1" />
      </label>
      <label class="settings-field settings-range">
        <span>Zoom — max <em id="settingsZoomMaxVal">1.50</em></span>
        <input type="range" id="settingsZoomMax" min="0.1" max="5" step="0.1" />
      </label>
      <label class="settings-check">
        <span>Pan</span>
        <input type="checkbox" id="settingsPan" />
        <span class="settings-switch" aria-hidden="true"></span>
      </label>
      <label class="settings-field settings-range">
        <span>Inertia (damping) <em id="settingsDampingVal">0.05</em></span>
        <input type="range" id="settingsDamping" min="0" max="0.3" step="0.01" />
      </label>
      <label class="settings-check">
        <span>Auto-rotate</span>
        <input type="checkbox" id="settingsAuto" />
        <span class="settings-switch" aria-hidden="true"></span>
      </label>
      <label class="settings-field settings-range" id="settingsAutoSpeedField">
        <span>Auto-rotate speed <em id="settingsAutoSpeedVal">2.0</em></span>
        <input type="range" id="settingsAutoSpeed" min="0.5" max="10" step="0.5" />
      </label>
      <button id="settingsResetView" class="settings-share" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"/></svg>
        <span>Reset view</span>
      </button>

      <div class="settings-section">Idle motion</div>
      <label class="settings-check">
        <span>Idle animation</span>
        <input type="checkbox" id="settingsIdle" />
        <span class="settings-switch" aria-hidden="true"></span>
      </label>
      <label class="settings-field settings-range" id="settingsIdleAmpField">
        <span>Amplitude <em id="settingsIdleAmpVal">0.10</em></span>
        <input type="range" id="settingsIdleAmp" min="0" max="0.5" step="0.01" />
      </label>
      <label class="settings-field settings-range" id="settingsIdleSpdField">
        <span>Speed <em id="settingsIdleSpdVal">0.03</em></span>
        <input type="range" id="settingsIdleSpd" min="0" max="0.15" step="0.005" />
      </label>
      <label class="settings-field settings-range" id="settingsIdleFlowField">
        <span>Wave spread <em id="settingsIdleFlowVal">0.10</em></span>
        <input type="range" id="settingsIdleFlow" min="0" max="0.5" step="0.01" />
      </label>

      <div class="settings-group">
        <label class="settings-check">
          <span>Intro spin animation</span>
          <input type="checkbox" id="settingsIntro" />
          <span class="settings-switch" aria-hidden="true"></span>
        </label>
        <label class="settings-check">
          <span>Show "Preview Poster" button</span>
          <input type="checkbox" id="settingsPoster" />
          <span class="settings-switch" aria-hidden="true"></span>
        </label>
        <label class="settings-check">
          <span>Font library drawer <em>(off = tap to cycle fonts)</em></span>
          <input type="checkbox" id="settingsFontDrawer" />
          <span class="settings-switch" aria-hidden="true"></span>
        </label>
        <label class="settings-check">
          <span>Highlight key on bar hover</span>
          <input type="checkbox" id="settingsHoverHighlight" />
          <span class="settings-switch" aria-hidden="true"></span>
        </label>
        <label class="settings-check">
          <span>Keystroke sound</span>
          <input type="checkbox" id="settingsSound" />
          <span class="settings-switch" aria-hidden="true"></span>
        </label>
      </div>
      <div class="settings-section">Boundary frame</div>
      <div class="settings-group">
        <label class="settings-check">
          <span>Show boundary</span>
          <input type="checkbox" id="settingsBoundary" />
          <span class="settings-switch" aria-hidden="true"></span>
        </label>
      </div>
      <label class="settings-field settings-range" id="settingsBoundaryGapField">
        <span>Offset <em id="settingsBoundaryGapVal">12</em></span>
        <input type="range" id="settingsBoundaryGap" min="0" max="12" step="1" />
      </label>
      <label class="settings-field settings-range" id="settingsBoundaryRadiusField">
        <span>Corner rounding <em id="settingsBoundaryRadiusVal">10</em></span>
        <input type="range" id="settingsBoundaryRadius" min="0" max="28" step="1" />
      </label>
      <label class="settings-field settings-range" id="settingsBoundaryOpacityField">
        <span>Opacity <em id="settingsBoundaryOpacityVal">50%</em></span>
        <input type="range" id="settingsBoundaryOpacity" min="0" max="1" step="0.05" />
      </label>
      <label class="settings-field settings-range" id="settingsBoundaryHeightField">
        <span>Height <em id="settingsBoundaryHeightVal">4.0</em></span>
        <input type="range" id="settingsBoundaryHeight" min="0" max="16" step="0.5" />
      </label>
      <label class="settings-field settings-range" id="settingsBoundaryThicknessField">
        <span>Thickness <em id="settingsBoundaryThicknessVal">1.5</em></span>
        <input type="range" id="settingsBoundaryThickness" min="0.5" max="8" step="0.5" />
      </label>
      <button id="settingsShare" class="settings-share" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14l6-4M9 10l6 4"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="7" r="2.5"/><circle cx="17.5" cy="17" r="2.5"/></svg>
        <span>Copy shareable link</span>
      </button>
      <p class="settings-hint">Layout changes reload the page with your text preserved.</p>
    `;
    host.appendChild(panel);

    reflectConfig();
    syncThemeSegment();

    const layoutSel = panel.querySelector('#settingsLayout') as HTMLSelectElement;
    layoutSel.addEventListener(
      'change',
      () => location.assign(buildShareUrl({ layout: layoutSel.value })),
      { signal }
    );

    // Live opacity slider for structural (non-data) keys — no reload.
    const opacitySlider = panel.querySelector('#settingsOpacity') as HTMLInputElement;
    const opacityVal = panel.querySelector('#settingsOpacityVal') as HTMLElement | null;
    opacitySlider?.addEventListener(
      'input',
      () => {
        const o = Number(opacitySlider.value);
        engine.setStructuralKeyOpacity(o);
        if (opacityVal) opacityVal.textContent = `${Math.round(o * 100)}%`;
      },
      { signal }
    );

    // Live per-channel opacity sliders — no reload.
    // Keycap labels — size / placement / weight (each recreates the label geometry).
    wireRange('#settingsTextSize', '#settingsTextSizeVal', (v) => engine.setTextSize(v), oneDec);
    wireRange('#settingsLabelWeight', '#settingsLabelWeightVal', (v) => engine.setLabelWeight(v), oneDec);
    panel.querySelector('#settingsLabelAnchor')?.addEventListener(
      'change',
      (e) => engine.setLabelAnchor((e.target as HTMLSelectElement).value as any),
      { signal }
    );

    // Main keys (the 36 data keys):
    wireRange('#settingsFaceOp', '#settingsFaceOpVal', (v) => engine.setFaceOpacity(v));
    wireRange('#settingsWallOp', '#settingsWallOpVal', (v) => engine.setWallOpacity(v));
    wireRange('#settingsOutlineOp', '#settingsOutlineOpVal', (v) => engine.setOutlineOpacity(v));
    wireRange('#settingsTextOp', '#settingsTextOpVal', (v) => engine.setTextOpacity(v));
    // Extra keys (structural placeholders): per-channel opacity.
    wireRange('#settingsExtraFace', '#settingsExtraFaceVal', (v) => engine.setExtraFaceOpacity(v));
    wireRange('#settingsExtraWall', '#settingsExtraWallVal', (v) => engine.setExtraWallOpacity(v));
    wireRange('#settingsExtraOutline', '#settingsExtraOutlineVal', (v) => engine.setExtraOutlineOpacity(v));
    wireRange('#settingsExtraText', '#settingsExtraTextVal', (v) => engine.setExtraTextOpacity(v));

    // Key growth — per-tap rise + composition ceiling (proportional auto-scale).
    wireRange('#settingsRise', '#settingsRiseVal', (v) => engine.setRisePerTap(v), dec);
    wireRange('#settingsMaxHeight', '#settingsMaxHeightVal', (v) => engine.setMaxKeyHeight(v), oneDec);
    wireRange('#settingsCursorThickness', '#settingsCursorThicknessVal', (v) => engine.setConfig({ cursor: { thickness: v } }), dec);
    wireRange('#settingsCursorRounding', '#settingsCursorRoundingVal', (v) => engine.setConfig({ cursor: { rounding: v } }));

    // Starting height — link toggle + combined/separate sliders.
    wireRange('#settingsHeightMain', '#settingsHeightMainVal', (v) => engine.setMainKeyHeight(v), dec);
    wireRange('#settingsHeightExtra', '#settingsHeightExtraVal', (v) => engine.setStructuralKeyHeight(v), dec);
    wireRange(
      '#settingsHeightAll',
      '#settingsHeightAllVal',
      (v) => {
        engine.setMainKeyHeight(v);
        if (hasStructuralKeys()) engine.setStructuralKeyHeight(v);
      },
      dec
    );
    wireToggle('#settingsHeightLink', (on) => {
      heightLinked = on;
      // Linking unifies both to the inspiring raised value (the extra-key height).
      if (on) {
        const v = engine.config.layout.structuralKeyHeight ?? 0;
        engine.setMainKeyHeight(v);
        engine.setStructuralKeyHeight(v);
      }
      reflectConfig();
    });

    // Idle "breathing" animation — live via setConfig (keyboard reads it per frame).
    const setIdle = (
      patch: Partial<{ enabled: boolean; amplitude: number; speed: number; flow: number; structural: boolean }>
    ) => engine.setConfig({ animation: { idle: patch } });
    wireToggle('#settingsExtraIdle', (on) => setIdle({ structural: on }));
    const idleChk = panel.querySelector('#settingsIdle') as HTMLInputElement;
    idleChk.addEventListener('change', () => setIdle({ enabled: idleChk.checked }), { signal });
    wireRange('#settingsIdleAmp', '#settingsIdleAmpVal', (v) => setIdle({ amplitude: v }), dec);
    wireRange('#settingsIdleSpd', '#settingsIdleSpdVal', (v) => setIdle({ speed: v }), dec);
    wireRange('#settingsIdleFlow', '#settingsIdleFlowVal', (v) => setIdle({ flow: v }), dec);

    // Camera & orbit — all live, no reload.
    // Projection: live-swap ortho/perspective; reveals the FOV slider for perspective.
    const projSel = panel.querySelector('#settingsProjection') as HTMLSelectElement;
    projSel?.addEventListener(
      'change',
      () => {
        engine.setProjection(projSel.value as 'orthographic' | 'perspective');
        reflectConfig();
      },
      { signal }
    );
    wireRange('#settingsFov', '#settingsFovVal', (v) => engine.setCameraFov(v), degFmt);
    const cam = (patch: Parameters<typeof engine.setCameraControls>[0]) =>
      engine.setCameraControls(patch);
    wireToggle('#settingsRotate', (on) => cam({ enableRotate: on }));
    wireToggle('#settingsZoomEnable', (on) => cam({ enableZoom: on }));
    wireToggle('#settingsPan', (on) => cam({ enablePan: on }));
    wireRange('#settingsPolarMin', '#settingsPolarMinVal', (v) => cam({ minPolarAngle: v * RAD }), degFmt);
    wireRange('#settingsPolarMax', '#settingsPolarMaxVal', (v) => cam({ maxPolarAngle: v * RAD }), degFmt);
    wireRange('#settingsZoomMin', '#settingsZoomMinVal', (v) => cam({ minZoom: v }), dec);
    wireRange('#settingsZoomMax', '#settingsZoomMaxVal', (v) => cam({ maxZoom: v }), dec);
    wireRange('#settingsDamping', '#settingsDampingVal', (v) => cam({ dampingFactor: v }), dec);
    // Auto-rotate: toggle reveals its speed slider (reflectConfig keeps it in sync).
    wireToggle('#settingsAuto', (on) => {
      cam({ autoRotate: on });
      reflectConfig();
    });
    wireRange('#settingsAutoSpeed', '#settingsAutoSpeedVal', (v) => cam({ autoRotateSpeed: v }), oneDec);
    // Horizontal-rotation fence: toggle on → ±(range) radians; off → unrestricted.
    const azRange = panel.querySelector('#settingsAzRange') as HTMLInputElement;
    wireToggle('#settingsAzLimit', (on) => {
      const deg = Number(azRange.value) || 90;
      cam(on ? { minAzimuthAngle: -deg * RAD, maxAzimuthAngle: deg * RAD } : { minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity });
      reflectConfig();
    });
    wireRange('#settingsAzRange', '#settingsAzRangeVal', (v) => cam({ minAzimuthAngle: -v * RAD, maxAzimuthAngle: v * RAD }), degFmt);
    panel.querySelector('#settingsResetView')?.addEventListener('click', () => engine.resetCameraView(), { signal });

    panel.querySelector('#settingsClose')?.addEventListener('click', () => close(), { signal });

    panel.querySelector('#settingsTheme')?.addEventListener(
      'click',
      (e) => {
        const btn = (e.target as HTMLElement).closest('button[data-theme]') as HTMLElement | null;
        if (!btn) return;
        const wantDark = btn.dataset.theme === 'dark';
        if (wantDark !== (engine.themeMode === 'dark')) {
          engine.setTheme(wantDark ? 'dark' : 'light');
        }
      },
      { signal }
    );

    const introChk = panel.querySelector('#settingsIntro') as HTMLInputElement;
    introChk.addEventListener(
      'change',
      () => location.assign(buildShareUrl({ intro: introChk.checked ? '' : '0' })),
      { signal }
    );

    const posterChk = panel.querySelector('#settingsPoster') as HTMLInputElement;
    posterChk.addEventListener(
      'change',
      () => engine.setConfig({ features: { poster: posterChk.checked } }),
      { signal }
    );

    // Font library drawer on/off — live; the font-library module re-reads this to
    // switch the trigger between "open drawer" and "cycle fonts".
    const fontDrawerChk = panel.querySelector('#settingsFontDrawer') as HTMLInputElement;
    fontDrawerChk.addEventListener(
      'change',
      () => engine.setConfig({ features: { fontDrawer: fontDrawerChk.checked } }),
      { signal }
    );

    // Bar-hover key spotlight on/off — live; the character-bar reads it per hover.
    const hoverChk = panel.querySelector('#settingsHoverHighlight') as HTMLInputElement;
    hoverChk.addEventListener(
      'change',
      () => {
        engine.setConfig({ features: { hoverHighlight: hoverChk.checked } });
        if (!hoverChk.checked) engine.clearHighlight();
      },
      { signal }
    );

    // Keystroke sound on/off — live; the sound module reads this flag per keystroke.
    const soundChk = panel.querySelector('#settingsSound') as HTMLInputElement;
    soundChk.addEventListener(
      'change',
      () => engine.setConfig({ features: { sound: soundChk.checked } }),
      { signal }
    );

    // Floor boundary outline on/off — live.
    const boundaryChk = panel.querySelector('#settingsBoundary') as HTMLInputElement;
    boundaryChk.addEventListener(
      'change',
      () => engine.setBoundary({ enabled: boundaryChk.checked }),
      { signal }
    );
    wireRange('#settingsBoundaryGap', '#settingsBoundaryGapVal', (v) => engine.setBoundary({ gap: v }), (v) => String(Math.round(v)));
    wireRange('#settingsBoundaryRadius', '#settingsBoundaryRadiusVal', (v) => engine.setBoundary({ radius: v }), (v) => String(Math.round(v)));
    wireRange('#settingsBoundaryOpacity', '#settingsBoundaryOpacityVal', (v) => engine.setBoundary({ opacity: v }));
    wireRange('#settingsBoundaryHeight', '#settingsBoundaryHeightVal', (v) => engine.setBoundary({ height: v }), (v) => v.toFixed(1));
    wireRange('#settingsBoundaryThickness', '#settingsBoundaryThicknessVal', (v) => engine.setBoundary({ thickness: v }), (v) => v.toFixed(1));

    const shareBtn = panel.querySelector('#settingsShare') as HTMLButtonElement;
    const shareLabel = shareBtn.querySelector('span') as HTMLElement; // keep the icon intact
    shareBtn.addEventListener(
      'click',
      async () => {
        const url = buildShareUrl();
        try {
          await navigator.clipboard.writeText(url);
          shareLabel.textContent = 'Copied!';
          setTimeout(() => (shareLabel.textContent = 'Copy shareable link'), 1500);
        } catch {
          showToast(url, false);
        }
      },
      { signal }
    );
  };

  const isOpen = () => panel?.classList.contains('open') ?? false;
  const open = () => {
    build();
    if (panel) {
      void panel.offsetWidth; // flush initial styles so the entrance animates on first open too
      panel.classList.add('open');
    }
  };
  const close = () => panel?.classList.remove('open');
  const toggleOpen = () => (isOpen() ? close() : open());

  toggle?.addEventListener('click', toggleOpen, { signal });

  // Reflect live engine state into the panel controls.
  offs.push(engine.on('theme', syncThemeSegment));
  offs.push(engine.on('config', reflectConfig));

  return () => {
    offs.forEach((off) => off());
    panel?.remove();
    panel = null;
  };
};
