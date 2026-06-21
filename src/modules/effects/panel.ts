/**
 * Experiment harness (dev-only consumer of the effects controller).
 *
 * It is NOT part of the shipped library surface — it's the playground tool for
 * answering "bloom, god rays, or both, and at what dosage?". Everything it shows is
 * generated from each pass's `schema`, so new effects get a UI for free.
 *
 * Design intent: fast COMPARISON + real NUMBERS.
 *  - 2×2 state matrix (None / Bloom / God Rays / Both) — flip looks instantly.
 *  - One master "mood" dosage on top of per-pass tuning.
 *  - Live FPS/ms so the cost of god rays is visible, not guessed.
 *  - "Fair scene" buttons that set each effect's ideal conditions before you judge it.
 *  - Copy-as-JSON → a look you like becomes a preset.
 */
import type { OpenKeysModule } from '../../core/types';
import type { EffectsController, ParamSpec } from './types';

const STYLE = `
.okfx{position:fixed;top:12px;right:12px;width:300px;max-height:calc(100vh - 24px);overflow:auto;
  z-index:99999;font:12px/1.4 ui-sans-serif,system-ui,sans-serif;color:#e8e8ea;
  background:rgba(18,18,20,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:12px;
  box-shadow:0 12px 40px rgba(0,0,0,.45);}
.okfx h3{margin:0 0 2px;font-size:12px;font-weight:600;letter-spacing:.02em;}
.okfx .sub{color:#8a8a92;font-size:10.5px;margin:0 0 10px;}
.okfx .matrix{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;}
.okfx .matrix button{appearance:none;cursor:pointer;border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.04);color:#cfcfd4;border-radius:8px;padding:7px 6px;font-size:11px;
  transition:all .12s ease;}
.okfx .matrix button:hover{background:rgba(255,255,255,.09);}
.okfx .matrix button.on{background:#5b8cff;border-color:#5b8cff;color:#fff;font-weight:600;}
.okfx .stat{display:flex;justify-content:space-between;align-items:center;
  background:rgba(255,255,255,.04);border-radius:8px;padding:6px 9px;margin-bottom:10px;}
.okfx .stat b{font-variant-numeric:tabular-nums;font-size:13px;}
.okfx .stat .dim{color:#8a8a92;}
.okfx .scenes{display:flex;gap:6px;margin-bottom:12px;}
.okfx .scenes button{flex:1;cursor:pointer;border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.04);color:#cfcfd4;border-radius:8px;padding:6px 4px;font-size:10px;}
.okfx .scenes button:hover{background:rgba(255,255,255,.09);}
.okfx section{border-top:1px solid rgba(255,255,255,.08);padding-top:10px;margin-top:6px;}
.okfx .head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.okfx .head label{display:flex;align-items:center;gap:7px;font-weight:600;font-size:11.5px;cursor:pointer;}
.okfx .head input{accent-color:#5b8cff;width:15px;height:15px;}
.okfx .row{margin-bottom:9px;}
.okfx .row .lbl{display:flex;justify-content:space-between;color:#b9b9c0;margin-bottom:3px;}
.okfx .row .lbl .v{font-variant-numeric:tabular-nums;color:#e8e8ea;}
.okfx input[type=range]{width:100%;accent-color:#5b8cff;height:14px;}
.okfx select{width:100%;background:#222226;color:#e8e8ea;border:1px solid rgba(255,255,255,.14);
  border-radius:6px;padding:4px 6px;font:inherit;}
.okfx .hint{color:#76767e;font-size:10px;margin-top:2px;}
.okfx .actions{display:flex;gap:6px;align-items:center;margin-top:10px;}
.okfx .actions button{cursor:pointer;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);
  color:#e8e8ea;border-radius:8px;padding:6px 10px;font:inherit;}
.okfx .actions .ok{color:#7bdca0;font-size:10.5px;}
.okfx.collapsed .body{display:none;}
.okfx .x{cursor:pointer;color:#8a8a92;border:none;background:none;font-size:14px;line-height:1;}
`;

const fmt = (n: number) => (Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, ''));

export function effectsPanel(controller: EffectsController): OpenKeysModule {
  return ({ engine, signal }) => {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.className = 'okfx';
    document.body.appendChild(root);

    const el = (tag: string, cls?: string, text?: string) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };

    // --- header ---
    const header = el('div', 'head');
    const title = el('div');
    title.append(el('h3', undefined, 'Environment FX — experiment'));
    title.append(el('div', 'sub', 'compare looks · tune dosage · read the cost'));
    const collapse = el('button', 'x', '–') as HTMLButtonElement;
    collapse.title = 'collapse';
    collapse.addEventListener('click', () => {
      root.classList.toggle('collapsed');
      collapse.textContent = root.classList.contains('collapsed') ? '+' : '–';
    }, { signal });
    header.append(title, collapse);
    root.append(header);

    const body = el('div', 'body');
    root.append(body);

    // --- state matrix ---
    const matrix = el('div', 'matrix');
    const states: { label: string; bloom: boolean; god: boolean }[] = [
      { label: 'None', bloom: false, god: false },
      { label: 'Bloom', bloom: true, god: false },
      { label: 'God Rays', bloom: false, god: true },
      { label: 'Both', bloom: true, god: true },
    ];
    const matrixBtns = states.map((s) => {
      const b = el('button', undefined, s.label) as HTMLButtonElement;
      b.addEventListener('click', () => {
        controller.setEnabled('bloom', s.bloom);
        controller.setEnabled('godrays', s.god);
        syncEnabled();
      }, { signal });
      matrix.append(b);
      return b;
    });
    body.append(matrix);

    // --- FPS / ms readout ---
    const stat = el('div', 'stat');
    const fpsEl = el('b', undefined, '–');
    const msEl = el('span', 'dim', '');
    stat.append(fpsEl, msEl);
    body.append(stat);

    // --- master mood ---
    body.append(rangeRow('Master mood (dosage)', 0, 1, 0.01, controller.getMood(), (v) => controller.setMood(v)));

    // --- fairness scene presets ---
    const scenes = el('div', 'scenes');
    const bloomScene = el('button', undefined, 'Bloom-fair\n(dark)') as HTMLButtonElement;
    bloomScene.style.whiteSpace = 'pre-line';
    bloomScene.addEventListener('click', () => {
      engine.setTheme('dark');
      controller.setEnabled('bloom', true);
      controller.setEnabled('godrays', false);
      syncEnabled();
    }, { signal });
    const godScene = el('button', undefined, 'God-rays-fair\n(persp · dark)') as HTMLButtonElement;
    godScene.style.whiteSpace = 'pre-line';
    godScene.addEventListener('click', () => {
      engine.setProjection('perspective');
      engine.setTheme('dark');
      controller.setEnabled('bloom', false);
      controller.setEnabled('godrays', true);
      syncEnabled();
    }, { signal });
    scenes.append(bloomScene, godScene);
    body.append(scenes);

    // --- per-pass sections (auto-generated from schema) ---
    const enableInputs = new Map<string, HTMLInputElement>();
    for (const pass of controller.list()) {
      const sec = el('section');
      const head = el('div', 'head');
      const label = el('label');
      if (pass.toggleable) {
        const cb = el('input') as HTMLInputElement;
        cb.type = 'checkbox';
        cb.checked = pass.enabled;
        cb.addEventListener('change', () => {
          controller.setEnabled(pass.name, cb.checked);
          syncEnabled();
        }, { signal });
        enableInputs.set(pass.name, cb);
        label.append(cb);
      }
      label.append(document.createTextNode(pass.label));
      head.append(label);
      sec.append(head);

      for (const [key, spec] of Object.entries(pass.schema)) {
        sec.append(controlFor(pass.name, key, spec));
      }
      body.append(sec);
    }

    // --- actions ---
    const actions = el('div', 'actions');
    const copy = el('button', undefined, 'Copy config JSON') as HTMLButtonElement;
    const okMsg = el('span', 'ok', '');
    copy.addEventListener('click', async () => {
      const json = JSON.stringify(controller.exportState(), null, 2);
      try {
        await navigator.clipboard.writeText(json);
        okMsg.textContent = 'copied ✓';
      } catch {
        console.log('[OpenKeys FX] config:\n' + json);
        okMsg.textContent = 'logged to console';
      }
      setTimeout(() => (okMsg.textContent = ''), 1600);
    }, { signal });
    actions.append(copy, okMsg);
    body.append(actions);

    // --- helpers ---
    function controlFor(passName: string, key: string, spec: ParamSpec): HTMLElement {
      const cur = controller.getOption(passName, key);
      if (spec.type === 'select') {
        const row = el('div', 'row');
        row.append(el('div', 'lbl', spec.label));
        const sel = el('select') as HTMLSelectElement;
        for (const opt of spec.options ?? []) {
          const o = el('option', undefined, opt) as HTMLOptionElement;
          o.value = opt;
          if (opt === cur) o.selected = true;
          sel.append(o);
        }
        sel.addEventListener('change', () => controller.setOption(passName, key, sel.value), { signal });
        row.append(sel);
        if (spec.hint) row.append(el('div', 'hint', spec.hint));
        return row;
      }
      if (spec.type === 'toggle') {
        const row = el('div', 'row');
        const lbl = el('label');
        const cb = el('input') as HTMLInputElement;
        cb.type = 'checkbox';
        cb.checked = Boolean(cur);
        cb.addEventListener('change', () => controller.setOption(passName, key, cb.checked), { signal });
        lbl.append(cb, document.createTextNode(' ' + spec.label));
        row.append(lbl);
        return row;
      }
      // range
      const row = rangeRow(spec.label, spec.min ?? 0, spec.max ?? 1, spec.step ?? 0.01, Number(cur), (v) =>
        controller.setOption(passName, key, v)
      );
      if (spec.hint) row.append(el('div', 'hint', spec.hint));
      return row;
    }

    function rangeRow(
      label: string,
      min: number,
      max: number,
      step: number,
      value: number,
      onInput: (v: number) => void
    ): HTMLElement {
      const row = el('div', 'row');
      const lbl = el('div', 'lbl');
      lbl.append(el('span', undefined, label));
      const vEl = el('span', 'v', fmt(value));
      lbl.append(vEl);
      row.append(lbl);
      const input = el('input') as HTMLInputElement;
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(value);
      input.addEventListener('input', () => {
        const v = Number(input.value);
        vEl.textContent = fmt(v);
        onInput(v);
      }, { signal });
      row.append(input);
      return row;
    }

    function syncEnabled() {
      const map = new Map(controller.list().map((p) => [p.name, p.enabled]));
      const b = !!map.get('bloom');
      const g = !!map.get('godrays');
      states.forEach((s, i) => matrixBtns[i].classList.toggle('on', s.bloom === b && s.god === g));
      for (const [name, input] of enableInputs) input.checked = !!map.get(name);
    }
    syncEnabled();

    // --- FPS pump ---
    let raf = requestAnimationFrame(function tick() {
      const { fps, ms } = controller.stats();
      fpsEl.textContent = fps ? `${fps} fps` : '– fps';
      msEl.textContent = ms ? `${ms} ms/frame` : '';
      raf = requestAnimationFrame(tick);
    });

    const teardown = () => {
      cancelAnimationFrame(raf);
      root.remove();
      style.remove();
    };
    signal.addEventListener('abort', teardown, { once: true });
    return teardown;
  };
}
