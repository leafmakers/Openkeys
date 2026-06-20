# OpenKeys — build log

A running log of major milestones, updated after each significant change so anyone
can see what's happening and why. Newest entries at the top.

---

## Modular refactor — extracting feature modules from the `ui.ts` monolith

**Goal:** a pure engine + typed events + composable `(ctx) => teardown` modules, so OpenKeys
is fully customizable (pick/configure modules) *and* full-featured (load them all). After that:
responsiveness + mobile + touch/gesture, and a senior-product-design UI polish pass.

### Done & pushed (`leafmakers/Openkeys`, authored `hello@leafmaker.app`)
- **Step 8** — sharded `styles/main.css` (3,295 lines) into `styles/tokens.css` (vars + Inter @import + body/canvas), `styles/base.css` (navbar, #controls, shadow slider, global button/.hidden, all @media), and each module's `style.css` (real styles now, not placeholders). Dropped **460 lines** of dead auth + AI-button CSS. Classification was fanned out across the file and validated for gap-free full coverage. Finalized the lib: per-module exports + `MODULE_REGISTRY` + `<open-keys modules="…">` parsing, and fixed `tsconfig.lib.json`'s stale `src/js/*` includes. Verified: identical light/dark render + font drawer, `build` (CSS 50.8 kB) and `build:lib` (now ships `dist-lib/style.css` + all module `.d.ts`) pass, console clean. **Modular refactor complete — `src/js/` is gone; everything is `core/` + `modules/` + `shared/`.**
- **Step 7** — extracted `modules/font-library` (pinned-font chips + prev/next, Google Fonts drawer with search/filters/sort, per-weight previews, A–Z quick-jump) with private `google-fonts.ts` (catalog fetch + CSS URLs) and `az-scroll-guide.ts`. Now applies fonts via `engine.setKeyCapFont` (so `activeFont` + the poster title stay in sync) and sets the HTML text-display `fontFamily`. API key read from `config.typography.googleFontsApiKey` (defaulted from `VITE_GOOGLE_FONTS_API_KEY` in `resolveConfig`). Teardown clears the search timeout, disconnects the weight observer, drops `body.font-drawer-open`. `theme-toggle` now self-gates (hides `#themeToggle` when disabled). **Deleted `src/js/ui.ts`**; `main.ts` composes the full module set. Removed the vestigial `#heightUp/#heightDown/#type` buttons and legacy `#warning` from `index.html`. Verified: chips/cycle/drawer/Esc, poster title reflects active font, both `build` + `build:lib` pass, no console errors.
- **Step 6** — extracted `modules/poster` (lazy modal; captures ONLY via `engine.exportImage()` so it's never blank; private `canvas-2d.ts` for the typographic overlay; title from `engine.activeFont` → "System" fallback; Esc/Ctrl+Enter/Space shortcuts) + `modules/settings-panel` (layout/theme/intro/poster + shareable URL; owns the shadow-angle slider; live poster toggle via `setConfig`→`config` event). Added `shared/toast.ts`. `ui.ts` down to ~1.3k lines (font library only). Verified: poster opens with a real PNG, Esc closes, theme segment + live poster-visibility toggle work, no console errors.
- **Step 1** — `core/` scaffolding: `emitter.ts`, `types.ts`, `compose.ts`; moved config/scene/keyboard/utils into `core/`.
- **Step 2** — `createEngine()` owns the render loop + lifecycle; app & lib route through it; removed `scene as any` casts.
- **Step 3** — keyboard fully decoupled from the DOM (emits `textchange`/`data`); engine owns `currentText`.
- **Step 4** — extracted `modules/character-bar` + `modules/typing-speed` + `shared/char-color.ts`. (WPM was silently broken — wrong element id — now fixed.)
- **Step 5a** — extracted `modules/theme-toggle`; bootstrap owns page-chrome theme + persistence.
- **Step 5b** — extracted `modules/text-input` (contenteditable, paste, type-anywhere, caret preservation, counter, clear button). Engine gained `hasKey()`. Bootstrap applies initial `?text=` on `ready`. `ui.ts` down to ~2036 lines. (Gotcha: every module imports `./style.css`, so the file must exist or the whole import chain dies — create the placeholder when scaffolding a module.)

### Remaining
- **UX pass** — responsiveness, mobile layout, touch/gesture (orbit/pinch/tap), and design polish
  (the redundant shadow-angle slider, font-drawer shadow, overlay positioning).

### Invariants (don't regress)
- `preserveDrawingBuffer: true` is required for poster export; export must force-render.
- Don't rewrite the contenteditable `textContent` on user keystrokes (caret collapses) — only on program/animation changes.
- Theme = 3 engine sinks + page chrome; keep in sync.
- rAF animations don't progress in the headless preview — verify clear/typeText in a real browser.
