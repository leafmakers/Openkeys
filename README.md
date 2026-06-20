# OpenKeys

Type a phrase and watch a 3D keyboard rise into a skyline — each key grows in
proportion to how often its letter appears. Orbit it, restyle it, switch layouts,
and export it as a poster. OpenKeys is a **configurable, embeddable typographic
data‑sculpture & poster generator**, fully client‑side with no backend.

**Live demo:** https://leafmakers.github.io/Openkeys/

---

## Features

- **3D keyboard skyline** — letter frequency drives key height (WebGL / three.js)
- **Configurable everything** — one typed config controls layout, data mapping,
  theme, lights, camera, animation, typography and branding
- **Multiple layouts** — QWERTY, AZERTY, Dvorak, Numpad, or your own grid
- **Pluggable data** — `frequency` (count letters), `static` (explicit values), or a
  `custom` function
- **Light / dark themes** with full color overrides
- **Shareable URL params** and an in‑app settings panel
- **Poster export** (PNG) with title, stats and a frequency bar
- **Zero backend, zero env vars** — runs anywhere static files are served
- **Embeddable** — `createOpenKeys()` factory and an `<open-keys>` web component

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production app -> dist/
```

## Configure via URL

The app reads a whitelisted set of query params (great for sharing links):

| Param    | Values                                  | Example          |
| -------- | --------------------------------------- | ---------------- |
| `text`   | any string                              | `?text=hello`    |
| `layout` | `qwerty` `azerty` `dvorak` `numpad`     | `?layout=dvorak` |
| `theme`  | `light` `dark`                          | `?theme=dark`    |
| `data`   | `frequency` `static`                    | `?data=frequency`|
| `font`   | a key‑cap font name                     | `?font=Georgia`  |
| `intro`  | `0` `1` (intro spin)                    | `?intro=0`       |
| `poster` | `0` `1` (show poster button)            | `?poster=0`      |

Example: `…/?text=bend%20the%20grid&layout=dvorak&theme=dark`

The in‑app **⚙ Settings** panel writes these for you and can copy a shareable link.

## Configure in code

Everything lives in [`src/js/config.ts`](src/js/config.ts). `defaultConfig` reproduces
the classic behavior; override any subset and `resolveConfig` deep‑merges it:

```ts
import { resolveConfig, DVORAK_ROWS } from './src/js/config';

const config = resolveConfig({
  text: 'hello',
  layout: { rows: DVORAK_ROWS, preset: 'dvorak', keySize: 12 },
  data: { mode: 'frequency', growthIncrement: 0.6 },
  theme: { mode: 'dark', dark: { keyTop: '#1b1b1b', keyText: '#ffd166' } },
  animation: { intro: { enabled: false } },
});
```

## Embed it

### As a web component

```html
<open-keys text="hello world" layout="dvorak" theme="dark"></open-keys>
<script type="module" src="openkeys.es.js"></script>
```

### As a library

```ts
import { createOpenKeys, DVORAK_ROWS } from 'openkeys';

const kb = createOpenKeys(document.getElementById('viz'), {
  text: 'open keys',
  layout: { rows: DVORAK_ROWS, preset: 'dvorak' },
});

kb.setText('new phrase');          // re-render from text (frequency mode)
kb.setData({ a: 9, b: 3, c: 1 });  // drive heights directly (static mode)
kb.setTheme('dark');
const png = kb.exportPoster();      // PNG data URL
kb.destroy();                       // tear down + free GPU resources
```

Build the library bundles (ES + UMD + type declarations) into `dist-lib/`:

```bash
npm run build:lib
```

`three` is a **peer dependency** of the library. The key‑cap fonts
(`dist-lib/fonts/*.typeface.json`) must be reachable at the configured path — host
them on your origin, or pass custom `typography.keyCapFonts` URLs.

## Project layout

```
src/js/config.ts    # the single config surface (defaults + URL parsing + merge)
src/js/scene.ts     # three.js scene, camera, lights, floor, poster capture
src/js/keyboard.ts  # the key grid, data→height mapping, animations
src/js/ui.ts        # app chrome: input, theme toggle, settings panel, font drawer, poster
src/lib/index.ts    # embeddable factory + <open-keys> web component
```

## License

[MIT](LICENSE)
