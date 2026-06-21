# OpenKeys

## 🎯 Goal (North Star — keep this in focus across every session)

**OpenKeys turns text into a 3D keyboard skyline** — type a phrase and each key rises by how
often its letter appears — a typographic data-art / poster tool that's **free, fully
client-side (no backend, no login, no keys), and usable & configurable by anyone.**

Two things must always stay true:

1. **Library-grade & modular** — a pure engine (config + scene + keyboard + typed events) with
   composable `(ctx) => teardown` feature modules. **Absolutely customizable** (pick & configure
   exactly the modules you want) yet **full-featured when you want it** (load them all). Embeddable
   anywhere via `createOpenKeys()` / `<open-keys>`.
2. **It just works, everywhere** — responsive, great on mobile, touch/gesture-friendly, fast.
   Design principle: *good design is one that works* — subtle, natural, genuinely useful changes
   over flashy ones.

Anything we build should move toward those. If a change doesn't serve them, reconsider it.

---

# Build log

A running log of major milestones, updated after each significant change so anyone
can see what's happening and why. Newest entries at the top.

---

## Fixed z-fighting flicker on key letters + edges (zoomed out)

**Problem:** with the full board zoomed out, the engraved letters and the key edges shimmered/flickered —
worse on the structural "extra" keys (modifiers/space/punctuation) than the 36 data keys.

**Root causes (verified against the live scene, not assumptions):**
1. **Depth precision starved by the camera planes.** The camera sits ~643u from the target (eye baked at
   `[-400, 341, 381]`); the board's keys span ~593–721u. With `near:1, far:1000`, perspective depth is
   *near-dominated*, giving only ~**0.025u** of resolvable depth at the board — but the letter-to-cap world
   gap is ~**0.02u**, *below* the buffer's resolution → guaranteed z-fight. (A first instinct of "lower near"
   would make this ~10× **worse**, and `far:500` would clip the whole board — an adversarial review caught
   this before any edit.)
2. **Letters nearly coplanar, and the gap collapses with height.** The text mesh is a child of the
   Y-scaled key box, so its world gap above the cap = `0.1 × displayHeight`. Structural keys rest at
   height 0.2 and **never grow** → gap stays ~0.02u; typed data keys grow → bigger gap → settle down.
   That's exactly why extras flicker more.
3. **Edge outlines are exactly coplanar** with the box edges (`EdgesGeometry`, same scale/position) — zero
   gap, so precision alone can't separate them.

**Fix:**
- **Camera planes (`src/core/config.ts`):** `near 1 → 50`, `far 1000 → 2800`. Raising near (the dominant
  term at this distance) lifts resolvable depth from ~0.025u to ~**0.0005u** (~50×), clearing the 0.02u
  letter gap with margin; far still brackets the board + dolly-out headroom.
- **Dolly fence (`config.ts` + `scene.ts` applyControlsConfig):** added `controls.minDistance:200,
  maxDistance:2200` (new `OrbitControlsConfig` fields). Perspective has no min/maxZoom, so without bounds a
  zoom could push the board past the new near/far. Now zoom stays within a valid, high-precision range.
- **Edge fix (`src/core/keyboard.ts` createKeyMaterial):** `polygonOffset:true, factor:1, units:1` on the
  key face materials, receding the faces a hair in depth so the *exactly-coplanar* edge lines (and the
  letters) reliably win the depth test. polygonOffset is polygon-only (doesn't touch the lines/letters
  themselves); it's a uniform shift, so inter-key order and shadows are unchanged.
- Left `structuralKeyHeight` at 0.2 (raising it would destroy the "flat until typed" silhouette) and did
  NOT enable `logarithmicDepthBuffer` (unnecessary once near/far are sane; costs perf + interacts with the
  transparent walls).

**Verified:** near=50/far=2800/bounds live in the running scene; letters + edges render solid/crisp at the
default view, at the worst-case grazing 57° zoomed-out angle, and in dark + orthographic; at max dolly-out
(~2100u) the whole board stays inside the frustum (no clipping); `tsc` + build clean.

---

## Tuned opening experience baked into defaults

**Goal:** make the app *open* in the exact state it had been tuned to in-browser — camera angle,
typography, boundary frame, opacities, idle motion — so first load matches the intended look.

Captured the live engine config + camera, then folded the deltas into `defaultConfig` (and the
`'full'` layout override) in `src/core/config.ts`:
- **Camera opening angle** — `camera.position.desktop` is now the captured eye `[-400.29, 341.33,
  381.45]` (orbit azimuth ≈ −0.82, polar 60°, ~643u from target) with `lookAt.desktop` matched to the
  controls target `[5,20,0]` for a clean first frame. Verified: `resetView()`/load's
  `applyCameraPlacement()` lands exactly there. Mobile left at its original placement (not separately
  tuned; the wide 'full' board needs its own mobile fit distance — revisit later).
- **Typography** — `textSize 2.5→3.3`, `labelAnchor center→top`, `labelWeight 1→1.05`.
- **Boundary frame** — `opacity 0.5→0.15`, `height 4→3` (subtler rim).
- **Appearance** — `outlineOpacity 1→0.4`, `textOpacity 1→0.9`, `extraOutlineOpacity 1→0.25`.
- **Idle motion** — `idle.structural false→true` (structural keys drift too).
- **Layout** — `LAYOUT_OVERRIDES.full.structuralKeyOpacity 0.35→0.9` (the boot preset is already 'full').
- **Cursor** — `thickness 0.105→0.085`.

Things deliberately *not* baked: `originX/originZ` (runtime-centred), `camera.frustum` (already set by
the 'full' override), `autoRotate` (kept `false` per the pristine capture), and any runtime-only state.

**Verified:** `tsc` clean (0 errors); fresh load reads back all 12 baked values; camera reset lands on
the captured eye exactly.

---

## 3D boundary frame (the floor outline becomes a real frame)

**Goal:** turn the keyboard's boundary — until now a thin flat stroke on the floor — into a true
3D element with adjustable height and thickness, so the board reads as sitting inside a case/tray.

**Config** — `scene.boundary` gained two fields (`src/core/config.ts`):
- `height` (world units, Y) — how tall the frame rises off the floor. `0` keeps the original flat stroke.
- `thickness` (world units, XZ) — radial wall width of the frame band ("how thick the boundary reads").
- Defaults moved to a visible-by-default 3D look: `{ enabled, gap:3, radius:2, opacity:0.5, height:4, thickness:1.5 }`.
- Note: for a *solid* rail, "width" and "thickness" are the same cross-section axis, so there's one
  control (`thickness`); `gap` (outward offset) + `radius` (rounding) complete the frame. A distinct
  hollow-frame inner-wall "width" can be added later if wanted.

**Rendering** (`src/core/keyboard.ts`):
- New `boundaryFrame` mesh alongside the existing flat-stroke `boundaryObject`. `rebuildBoundary()`
  builds an `ExtrudeGeometry` from a rounded-rect `Shape` with an inner rounded-rect hole (the ring),
  extruded up by `height`; `roundedRectPath()` helper traces both. Shows the frame when `height>0 &&
  thickness>0`, else falls back to the flat stroke — never both.
- `MeshStandardMaterial` (lit) so faces shade and it reads as solid 3D in **both** themes (the 5-light
  rig is present in dark mode too — dark keys are flat by choice, not for lack of light). Color = theme
  outline; opacity → transparent/`depthWrite` handled.
- Fixed a latent gap: `updateTheme()` now calls `updateBoundary()`, so the stroke/frame recolor on
  theme switch (previously the boundary kept its old theme color).

**Engine/UI:** `setBoundary()` is generic (`Object.assign`), so the new fields needed no engine change.
Settings panel renamed "Floor boundary" → "Boundary frame" with two new sliders (Height 0–16, Thickness
0.5–8), wired + reflected like the rest.

**Verified:** `tsc` clean (0 errors); renders in light + dark; live Height/Thickness/Opacity sliders
update instantly; `height:0` fallback restores the flat stroke (line visible, frame hidden).

---

## Navbar quick view-toggles (auto-rotate · turntable · projection)

**Goal:** put the three most-wanted 3D-view controls one click away in the top-right navbar,
instead of buried in the settings panel.

**Added** three icon buttons in `#navbarActions` (between the poster download and theme toggle):
- **Auto-rotate** — the turntable spins on its own (`camera.controls.autoRotate`). Circular-arrow icon.
- **Turntable** — drag-to-orbit on/off (`camera.controls.enableRotate`). Sphere + tilted orbit-ring icon
  (deliberately distinct from the auto-rotate arrow; an earlier ellipse+dot read like an "eye").
- **Projection** — perspective ⇆ parallel/orthographic (`camera.projection`). Cube icon; active = perspective,
  and the title flips to say what a click will do.

**How:** a new `view-toggles` module (`src/modules/view-toggles/`) wires the clicks through the
*existing* engine API — `setCameraControls()` and `setProjection()` (both already live + both emit
`config`). No new engine/core surface. Each button mirrors live state (`.active` + `aria-pressed`),
and because it re-syncs on the `config` event it stays in lockstep with the settings panel (change it
in either place, both update). Active state styled in the module's `style.css` (accent-tinted pill via
`color-mix`); hidden < 560px to keep the phone navbar uncluttered. Composed in `main.ts` after `themeToggle`.

**Verified:** all three buttons present + functional (click flips config + `.active` together; driving the
engine directly updates the buttons → two-way sync confirmed); projection toggle visibly switches the board
between parallel and converging edges; no console errors; `tsc` + build clean.

---

## Taller cursor + band-filling headline

**Problem:** the new block caret read "short and stout" — it only filled ~half the text band
because the empty/first-words font was capped at a fixed 52px, leaving the band's lower half
empty; and the caret itself was only 0.88em tall.

**Fix (size to the available height):**
- Auto-fit now sizes the empty field + first words to the band's *actual* height
  (`oneLineFont()` = largest font ≤ MAX_FONT whose single line fills `clientHeight`), instead of
  a fixed 52px. `MAX_FONT` raised to 88 as a generous ceiling — the real cap is the band, so the
  headline fills the full height available (e.g. ~78–81px in a 96–100px band) and is responsive
  to it. It equals the size the first character settles at, so nothing jumps. The fixed band
  height is unchanged, so the WPM/counter/bar rows never move.
- Caret made taller: `height 0.88em → 1.04em` (spans the full line — cap height + descender),
  width `0.16 → 0.15em` (thickness unchanged in feel), `vertical-align -0.2em`. At the band-fill
  size that's ≈ 84px tall × 12px wide (≈ 7:1) — tall and confident, not stout.

**Verified:** empty field renders an 81px headline size with an 84px tall rounded block caret;
the same caret sits at the text end while typing ("uncommon craft" screenshot); responsive to
band height (77px band → 62px/64px); other rows undisturbed; `tsc` + build clean, console clear.

---

## Consistent, bold block cursor

**Problem:** the cursor was inconsistent — a custom thin bar in the empty state, then the
browser's thin native caret while typing — and didn't read as a confident "type here" invite.

**Fix (one caret, everywhere):** hide the native caret (`caret-color: transparent`) and draw a
single block caret via `#textDisplay::after`, shown both while focused (typing) and in the empty
invite state. Dimensions are in `em` — `width 0.16em`, `height 0.88em`, `border-radius 0.08em`
(≈ half the width → fully rounded capsule ends) — so the **proportions stay identical** as the
auto-fit scales the font. It reads large + thick on the empty field and through the first words
(auto-fit keeps short text at MAX_FONT 52px), then scales down with the phrase — never collapsing
to a hairline. Also hides the `<br>` browsers auto-insert into an empty contenteditable (this app
is single-line; Enter is prevented), which had been pushing the empty-state caret onto a clipped
2nd line.

**Verified:** empty-state caret screenshots as a big bold rounded block; `::after` computes to
8.3 × 45.8 px, 4.16 px radius; `:focus::after` renders the same block after the text while typing
(confirmed when the preview window held focus — headless focus is flaky, but it's correct in a
real browser). `tsc` + build clean.

---

## Fix core typing bugs (space, Enter, missing caret)

**Root cause:** the field is a real `contenteditable`, but "type-anywhere" *reimplemented* a
text editor instead of using it. When you typed without first clicking the field, every key
went through that synthetic path, which: dropped Space on desktop (no `' '` key → and the
poster's Space-preview fired instead), appended the literal string **"enter"** (the layout has
an `enter` key, so `hasKey('enter')` was true), and showed **no caret** (the field was never
focused).

**Fix (architectural):** the contenteditable is now the single, always-on input.
- Type-anywhere no longer synthesizes text — it just **focuses the field** and lets the browser
  deliver the keystroke (caret, space, Enter, selection, editing all native/correct).
- The field **autofocuses on load** (desktop; mobile keeps tap-to-type so the soft keyboard
  doesn't pop). It keeps the big invite caret while focused-empty, switching to the native caret
  on the first character.
- **Enter** only `preventDefault`s the newline (no blur) — stays in flow, never inserts text.
- Removed the now-dead synthetic editor (`getDisplayText`, the per-key append path).

**Verified (desktop preview):** autofocus on load; "hello world" / "Place your bets" keep their
spaces (count correct); `caret-color` visible + `data-placeholder` cleared while typing; Enter
prevented and focus retained; a keystroke while unfocused refocuses the field; poster Space-preview
correctly stands down while the field is focused. `tsc` + build clean, console clear.

---

## Proportional key-height auto-scale (composition-safe growth)

**Problem:** fixed `growthIncrement × count` is unbounded — in a long sentence a frequent
letter (e.g. 'e') towers out of frame and wrecks the composition.

**Fix:** the per-tap rise auto-scales like the auto-fitting headline. `effectivePerTap() =
min(growthIncrement, maxKeyHeight / maxDataValue)`, so:
- short / sparse text rises at the full configured rate (responsive, unchanged);
- once the busiest key would pass the ceiling, every key compresses *proportionally* — the
  tallest sits exactly at `maxKeyHeight` and the relative skyline shape is preserved.
- `maxKeyHeight = 0` → uncapped (classic linear).

Implementation: `keyboard.baseHeightFor()` uses `effectivePerTap()`; a cached `maxDataValue`
(`recomputeMaxValue()`) is refreshed wherever counts change (processTextInput now two-pass:
set all values → recompute max → size; plus the typing/backspace animation steps). New config
`data.maxKeyHeight` (default 4); `growthIncrement` is now "rise per tap". Engine
`setRisePerTap`/`setMaxKeyHeight`; settings "Key growth" section (Rise per tap + Max height
sliders + hint); URL `?rise=` / `?maxh=`.

**Verified:** `e×20` → tallest holds at the cap (4.0 / 2.0) while others scale with it
(a: 0.5→0.2→0.1); a realistic pangram caps the tallest data key at exactly 4.0; sliders reflect
+ drive live; `tsc` + build clean.

---

## Delete-key affordance polish + wall (side-face) opacity control

- **Delete key now has a hover affordance** (discoverability): hovering it on the canvas
  shows `cursor: pointer` + a **subtle red tint** (reusing the reversible `highlightKey`, not a
  heavy solid-red material swap — the old flash read as a dark block). Tap presses it down
  (`keyboard.pressKey`, renamed from `flashKeyPress`, height-only) and clears the text. Engine
  pointer handling gained `pointermove` hover (mouse only) + `setDeleteHover`; touch applies the
  red for the tap then clears it. Accent = `#ff453a` (iOS red) tinted gently.
- **Side-wall opacity is now independently controllable.** `faceOpacity` was dimming top + sides
  together; split so `faceOpacity` = top cap only and new `wallOpacity` = the 4 side walls, for
  both main and extra keys (`config.appearance.wallOpacity` / `extraWallOpacity`, default 1).
  `applyOpacities` keys off BoxGeometry index 2 (top) vs the rest (walls). Engine
  `setWallOpacity`/`setExtraWallOpacity`; settings sliders ("Face (top)" + "Wall (sides)") for
  both groups; URL `?walls=` / `?ewalls=`.
- Verified: hovering the delete key → pointer cursor + subtle red; wall sliders make the side
  walls glassy while caps stay solid; `tsc` + build clean.

---

## Structural-key height + clickable delete key

- **Structural keys now have a resting height** so the non-data keys (modifiers, space,
  punctuation in the `full` layout) read as real 3D keys instead of lying flat. New
  `config.layout.structuralKeyHeight` (default 0.6, units = same as `growthIncrement × count`)
  via a `baseHeightFor(key)` helper used everywhere height is computed (reset, processText,
  idle, validation). Live `engine.setStructuralKeyHeight()` + `?skh=`.
- **Structural-key idle reaction is configurable** — `config.animation.idle.structural`
  (default false; the board stays still, only data keys breathe). Live via `setConfig` + `?idlestruct=`.
- **Settings** (Extra keys section): "Resting height" slider + "Breathe with idle animation"
  toggle; both reflect live and pin into the shareable link.
- **Clickable delete key** — canvas pointer taps are raycast to 3D keys (`keyboard.pickKeyId`,
  meshes tagged `userData.keyId`); a tap (not an orbit-drag) on the delete/backspace key flashes
  all its faces red, presses it down (`flashKeyPress`, idle-suppressed via `animatingKeys`), and
  proxies `engine.clear()`. Verified: ray at the backspace key picks `backspace`, screen-centre
  picks the `9` data key. (Flash + clear cascade are rAF-driven — auditioned in a real browser.)

---

## Keystroke sounds — new `sound` module

**Goal:** an audible click on every character typed and a softer one per character cleared.

- New `src/modules/sound/` — a DOM-less module that listens to the engine's `textchange` and
  compares length: a character added → type click, a character removed → clear click (so the
  backspace/clear animation makes a per-key cascade).
- Plays the bundled **Apple Magic Keyboard** sample (`src/modules/sound/key-press.mp3`, from
  `SFX/`) via **Web Audio** (overlapping, low-latency); clear uses the same sample lower + softer
  (`playbackRate 0.82`). Synthesized-click fallback if the sample ever fails to decode.
- Zero network: the mp3 is bundled by Vite (`dist/assets/key-press-*.mp3`). Gated by
  `config.features.sound` (default on) and `?sound=0/1`. Audio unlocks on first user gesture
  (browser autoplay policy), so nothing plays on load.
- Verified: app inits clean, sample fetched/decoded, type+clear path runs error-free, build OK.
  (Can't audition in the headless preview — gesture-gated.)

---

## Experimental: full (Mac) keyboard layout — branch `experiment/full-keyboard-layout` (NOT pushed)

**Goal:** the classic board only renders the 36 alphanumeric keys; add the surrounding
structural keys (modifiers, space bar, punctuation) so it reads as a real keyboard and fills
out to a clean rectangle — kept modular and instantly toggleable so it's trivial to drop.

- **Width-aware cell model.** `LayoutConfig.rows` accepts `{ id, label, w?, typeable? }` alongside
  plain strings (a bare string still normalizes to a 1u typeable data key, so QWERTY/AZERTY/
  Dvorak/Numpad are byte-for-byte unchanged). Keys are now stored by **unique id**, not label, so
  duplicate modifiers (two shift/cmd/opt/ctrl) don't collide. Key geometry/outlines are
  variable-width; labels are glyph-tolerant and auto-shrink for multi-char caps.
- **`full` preset** (`FULL_ROWS` + `LAYOUT_OVERRIDES` in `config.ts`). A Mac-style ~60% board:
  every row is exactly 15u so the silhouette is rectangular while letters keep their stagger
  (from edge-key widths, not row offset). Structural keys are inert (`typeable:false`) — only
  letters/numbers grow. The override re-centres the wider board (`originX/Z`, `rowStagger:0`) and
  zooms the camera out ~1.5x (`frustum` 80→120 / 45→70) so nothing clips on portrait/mobile.
- **Toggle:** `?layout=full` or the settings dropdown ("Full (Mac) — experimental"); default
  stays QWERTY. To remove entirely: delete `FULL_ROWS` + `LAYOUT_OVERRIDES` and the dropdown
  `<option>`. Verified: `tsc`, `build`, `build:lib` pass; console clean; QWERTY unchanged.

---

## Modular refactor — extracting feature modules from the `ui.ts` monolith

**Goal:** a pure engine + typed events + composable `(ctx) => teardown` modules, so OpenKeys
is fully customizable (pick/configure modules) *and* full-featured (load them all). After that:
responsiveness + mobile + touch/gesture, and a senior-product-design UI polish pass.

### Done & pushed (`leafmakers/Openkeys`, authored `hello@leafmaker.app`)
- **UX follow-up — Clear button.** The "Clear ×" button floated in its own right-aligned row above the input card (disconnected, odd). Moved it into a small circular **✕ pinned in the card's top-right corner**, shown only when there's text (toggled in `writeDisplay`), with right-padding reserved so text never runs under it. Now available on mobile too (the old row was hidden). Verified show/hide via `setText` + position inside the card on desktop and mobile; console clean.
- **Adversarial review + fixes.** Ran a multi-dimension correctness review (lifecycle/leaks, text-input, responsive CSS, modules/lib) with every finding independently verified. Fixed the 4 real bugs + polish: (1) focusing the empty field re-inserted the placeholder as editable text → clear without re-running placeholder logic; (2) text-input leaked its `engine.on('textchange')` subscription → captured + unsubscribed in teardown; (3) paste now leaves the caret after the inserted text; (4) `removeFavoriteFont` kept the wrong font active when removing a chip before the cursor → decrement the index; plus `-webkit/-moz-appearance` on the custom selects (Safari double-chevron) and a fallback for the undefined `--accent-hover`. Verified in-browser. (Known pre-existing limitation, intentionally not touched: the font drawer's Popularity/Trending/Date sort only reorders within each A–Z letter group, since the list is always letter-grouped for the quick-jump rail.)
- **UX pass (part 1) — responsive + touch + decluttering.** Ran a multi-lens senior-design critique (visual-hierarchy / responsive / interaction / minimalist) + synthesis to anchor the work as *decluttering & consolidation, not a redesign*. Changes: removed the vestigial shadow-angle slider (markup + JS wiring + ~170 lines CSS; `engine.setLightAngle` stays a lib API). Collapsed the two-hard-coded-layouts-fighting-with-`!important` into **one responsive system** — a single text dock (`#textDisplayWrapper` = input + WPM/count + frequency bar) that is a top card on desktop and a bottom dock on mobile, children in normal flow (the WPM/bar-under-card overlap bug is gone at the root). Removed the duplicate `#mobileTextDisplay` (one `#textDisplay` everywhere; text-input + font-library updated). Bottom `#controls` is now a tidy row of two matched pills (font picker + Preview Poster). Real mobile **tap-to-type**: a stationary tap on the canvas focuses the field (drags stay orbit gestures), `visualViewport` lifts the dock above the soft keyboard (`--kb-inset`), placeholder reads "Tap to type…" on coarse pointers. Lightened the font-drawer backdrop/shadow and fixed its broken mobile layout (single-column full-width stack instead of an off-screen 2-col grid). `base.css` 1051→~440 lines (all dead auth/AI/heightUp/type/warning CSS gone). Verified across desktop+mobile × light+dark, drawer, poster, settings; `build` + `build:lib` pass; console clean.
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
