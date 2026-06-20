# OpenKeys — build log

A running log of major milestones, updated after each significant change so anyone
can see what's happening and why. Newest entries at the top.

---

## Modular refactor — extracting feature modules from the `ui.ts` monolith

**Goal:** a pure engine + typed events + composable `(ctx) => teardown` modules, so OpenKeys
is fully customizable (pick/configure modules) *and* full-featured (load them all). After that:
responsiveness + mobile + touch/gesture, and a senior-product-design UI polish pass.

### Done & pushed (`leafmakers/Openkeys`, authored `hello@leafmaker.app`)
- **Step 6** — extracted `modules/poster` (lazy modal; captures ONLY via `engine.exportImage()` so it's never blank; private `canvas-2d.ts` for the typographic overlay; title from `engine.activeFont` → "System" fallback; Esc/Ctrl+Enter/Space shortcuts) + `modules/settings-panel` (layout/theme/intro/poster + shareable URL; owns the shadow-angle slider; live poster toggle via `setConfig`→`config` event). Added `shared/toast.ts`. `ui.ts` down to ~1.3k lines (font library only). Verified: poster opens with a real PNG, Esc closes, theme segment + live poster-visibility toggle work, no console errors.
- **Step 1** — `core/` scaffolding: `emitter.ts`, `types.ts`, `compose.ts`; moved config/scene/keyboard/utils into `core/`.
- **Step 2** — `createEngine()` owns the render loop + lifecycle; app & lib route through it; removed `scene as any` casts.
- **Step 3** — keyboard fully decoupled from the DOM (emits `textchange`/`data`); engine owns `currentText`.
- **Step 4** — extracted `modules/character-bar` + `modules/typing-speed` + `shared/char-color.ts`. (WPM was silently broken — wrong element id — now fixed.)
- **Step 5a** — extracted `modules/theme-toggle`; bootstrap owns page-chrome theme + persistence.
- **Step 5b** — extracted `modules/text-input` (contenteditable, paste, type-anywhere, caret preservation, counter, clear button). Engine gained `hasKey()`. Bootstrap applies initial `?text=` on `ready`. `ui.ts` down to ~2036 lines. (Gotcha: every module imports `./style.css`, so the file must exist or the whole import chain dies — create the placeholder when scaffolding a module.)

### Remaining
- **Step 7** — `font-library` module (+ az-scroll-guide, google-fonts); then delete `ui.ts`.
- **Step 8** — CSS sharding (`tokens.css`/`base.css` + per-module) + finalize lib exports & `<open-keys modules="…">`.
- **UX pass** — responsiveness, mobile layout, touch/gesture (orbit/pinch/tap), and design polish
  (the redundant shadow-angle slider, font-drawer shadow, overlay positioning).

### Invariants (don't regress)
- `preserveDrawingBuffer: true` is required for poster export; export must force-render.
- Don't rewrite the contenteditable `textContent` on user keystrokes (caret collapses) — only on program/animation changes.
- Theme = 3 engine sinks + page chrome; keep in sync.
- rAF animations don't progress in the headless preview — verify clear/typeText in a real browser.
