/**
 * text-input — the single editable phrase field, the live character counter, the
 * clear button, "type anywhere" capture (desktop), and mobile tap-to-type.
 *
 * One field, top-anchored on every viewport (positioned by base.css). On touch
 * devices there's no physical keyboard, so document-level keydown ("type anywhere")
 * never fires — instead a tap on the 3D canvas focuses the field and raises the soft
 * keyboard. The dock stays pinned under the navbar (the keyboard opens from the
 * bottom, so it never collides with it).
 *
 * Caret rule: on user keystrokes we DON'T rewrite the contenteditable's textContent
 * (that collapses the caret) — only program/animation changes (engine `textchange`
 * with source 'program') write the text back.
 */
import type { OpenKeysModule } from '../../core/types';
import { tapSlop } from '../../core/utils';
import './style.css';

// The empty state is a large blinking caret (styled in CSS), not placeholder copy
// — the cursor itself is the invitation to type. Kept as '' so the existing
// placeholder plumbing (data-placeholder attr, clear-button gating) still works.
const PLACEHOLDER = '';

// Auto-fit bounds (px). The empty field + first words fill the band's FULL height
// (computed from the box, capped at MAX_FONT) so the caret/headline read big and
// confident; as the phrase grows the font shrinks toward MIN_FONT to keep it within
// the fixed height budget. MAX_FONT is a generous ceiling — the real cap is usually
// the band height. MIN_FONT stays ≥16 to avoid iOS focus-zoom.
const MAX_FONT = 88;
const MIN_FONT = 18;

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) || host.querySelector<HTMLElement>(`#${id}`);
}

export const textInput: OpenKeysModule = ({ engine, host, signal }) => {
  const textDisplay = resolve(host, 'text-display', 'textDisplay');
  const counter = resolve(host, 'character-count', 'characterCount');
  const clearBtn = resolve(host, 'clear-button', 'clearButton');
  if (!textDisplay) return () => {};

  const maxChars = () => engine.config.features.maxCharacters;
  const isMobile = () => window.innerWidth <= engine.config.scene.mobileBreakpoint;
  let hasInteracted = false;
  let isUpdating = false;

  const setPlaceholderAttr = (on: boolean) => {
    if (on) textDisplay.setAttribute('data-placeholder', 'true');
    else textDisplay.removeAttribute('data-placeholder');
  };

  /** Write the editable text + placeholder state to the display node. */
  const writeDisplay = (text: string, skipTextWrite = false) => {
    const isPlaceholder = !hasInteracted && !text;
    const shown = isPlaceholder ? PLACEHOLDER : text;
    if (!skipTextWrite) textDisplay.textContent = shown;
    setPlaceholderAttr(isPlaceholder);
    if (clearBtn) clearBtn.style.display = !isPlaceholder && text ? 'flex' : 'none';
    autofit();
  };

  // The clear button + right padding read this live font size to scale/position
  // with the text; set on the wrapper so both #textDisplay and #clearButton see it.
  const wrapper = textDisplay.parentElement;
  const applyFont = (px: number) => {
    textDisplay.style.fontSize = `${px}px`;
    wrapper?.style.setProperty('--ok-type-size', `${px}px`);
  };

  /** Largest font (≤ MAX_FONT) whose single line fills the fixed band height. The
   *  empty field + first words use this so they're as TALL as the box allows — and
   *  it equals the size the first typed character settles at, so nothing jumps. */
  const oneLineFont = (): number => {
    const cs = getComputedStyle(textDisplay);
    const padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const lhRatio = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.18;
    const budget = textDisplay.clientHeight;
    if (!(budget > 0)) return MAX_FONT;
    return Math.max(MIN_FONT, Math.min(MAX_FONT, Math.floor((budget - padV) / lhRatio)));
  };

  /**
   * Size the phrase (and therefore the caret, whose height tracks font-size) to the
   * FIXED-height box: empty/short text fills the band height (oneLineFont), longer
   * text shrinks by binary-search until every line fits. Because the box height is
   * fixed, the rows below (WPM/count, frequency bar) never move as the text grows.
   */
  const autofit = () => {
    const hasText = !!(textDisplay.textContent && textDisplay.textContent.length);
    const budget = textDisplay.clientHeight; // fixed; includes padding, as scrollHeight does
    if (!hasText || !(budget > 0)) {
      applyFont(oneLineFont());
      return;
    }
    let lo = MIN_FONT,
      hi = MAX_FONT,
      best = MIN_FONT;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      textDisplay.style.fontSize = `${mid}px`;
      if (textDisplay.scrollHeight <= budget) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    applyFont(best);
  };

  const setCursorToEnd = (position?: number) => {
    try {
      const range = document.createRange();
      const selection = window.getSelection();
      if (textDisplay.childNodes.length > 0) {
        const node = textDisplay.childNodes[0];
        const len = node.textContent?.length || 0;
        const pos = position !== undefined ? Math.min(position, len) : len;
        range.setStart(node, pos);
        range.setEnd(node, pos);
      } else {
        range.setStart(textDisplay, 0);
        range.setEnd(textDisplay, 0);
      }
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch {
      /* ignore caret errors */
    }
  };

  /** Apply text from a non-focused path (type-anywhere / programmatic). */
  const applyText = (text: string, skipTextWrite = false) => {
    writeDisplay(text, skipTextWrite);
    if (isUpdating) return;
    isUpdating = true;
    try {
      engine.setUserText(text);
    } finally {
      isUpdating = false;
    }
  };

  // --- Focused editing on the contenteditable ---
  const handleInput = () => {
    if (isUpdating) return;
    const text = textDisplay.textContent || '';
    if (!hasInteracted && text.trim()) hasInteracted = true;

    if (text.length > maxChars()) {
      const sel = window.getSelection();
      const cursor = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startOffset : 0;
      const truncated = text.slice(0, maxChars());
      textDisplay.textContent = truncated;
      setCursorToEnd(Math.min(cursor, truncated.length));
      applyText(truncated);
      return;
    }
    // Normal typing: don't rewrite textContent (preserve caret), just drive the engine.
    applyText(text, true);
  };

  textDisplay.addEventListener('input', handleInput, { signal });
  textDisplay.addEventListener(
    'blur',
    () => {
      // Leaving an empty, never-typed field restores the blinking invite caret.
      if (!hasInteracted && !textDisplay.textContent) {
        setPlaceholderAttr(true);
        autofit();
      }
    },
    { signal }
  );
  textDisplay.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      // Single-line field: Enter must never insert a newline. Prevent it but keep
      // focus + caret so the user stays in flow (they can keep typing).
      if (e.key === 'Enter') e.preventDefault();
    },
    { signal }
  );
  textDisplay.addEventListener(
    'paste',
    (e: ClipboardEvent) => {
      e.preventDefault();
      const clean = (e.clipboardData?.getData('text') || '').replace(/\n/g, ' ').trim();
      if (!hasInteracted) {
        hasInteracted = true;
        textDisplay.textContent = '';
      }
      const sel = window.getSelection();
      const cursor = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startOffset : (textDisplay.textContent || '').length;
      const cur = textDisplay.textContent || '';
      textDisplay.textContent = (cur.slice(0, cursor) + clean + cur.slice(cursor)).slice(0, maxChars());
      setCursorToEnd(Math.min(cursor + clean.length, (textDisplay.textContent || '').length));
      applyText(textDisplay.textContent || '');
    },
    { signal }
  );

  // --- Type anywhere ---
  // Rather than reimplement a text editor (the old path mis-handled space/Enter and
  // had no caret), a keystroke when nothing is focused simply FOCUSES the real
  // contenteditable and lets the browser deliver that keystroke — so the caret,
  // spaces, Enter, selection and editing are all native and correct.
  const isInputFocused = () => {
    const a = document.activeElement;
    return a?.tagName === 'INPUT' || a?.tagName === 'TEXTAREA' || (a as HTMLElement)?.isContentEditable === true;
  };
  const isModalOpen = () => document.getElementById('previewModal')?.style.display === 'block';

  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (isInputFocused() || isModalOpen()) return;
      // Leave shortcut combos and the orbit/zoom modifiers alone.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Only a single printable character (letters, digits, punctuation, space) or
      // Backspace should start/resume editing; ignore Tab, arrows, F-keys, etc.
      const isPrintable = e.key.length === 1;
      if (!isPrintable && e.key !== 'Backspace') return;
      // Focus the field and put the caret at the end; the browser routes THIS key
      // (and everything after) into it natively. We don't preventDefault, so the
      // character lands in the now-focused field.
      textDisplay.focus({ preventScroll: true });
      setCursorToEnd();
    },
    { signal }
  );

  // --- Mobile tap-to-type: a tap (not an orbit drag) on the canvas focuses the field ---
  const canvas = engine.canvas;
  let downX = 0, downY = 0, downT = 0;
  canvas.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
    },
    { signal, passive: true }
  );
  canvas.addEventListener(
    'pointerup',
    (e: PointerEvent) => {
      if (!isMobile() || isModalOpen()) return;
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      // Only a quick, near-stationary tap counts — a drag is an orbit gesture, leave it
      // alone. A tap on the delete key is consumed by the engine (stopImmediatePropagation),
      // so this never runs for it — clearing the board won't also pop the keyboard.
      if (moved < tapSlop(e.pointerType) && performance.now() - downT < 700) {
        textDisplay.focus({ preventScroll: true });
        setCursorToEnd();
      }
    },
    { signal }
  );

  // Re-fit when the box width changes (wrapping changes the needed font-size).
  window.addEventListener('resize', autofit, { signal });

  // --- Clear button ---
  clearBtn?.addEventListener(
    'click',
    async () => {
      await engine.clear();
      hasInteracted = false;
      writeDisplay('');
    },
    { signal }
  );

  // --- React to programmatic/animation changes from the engine ---
  const offTextChange = engine.on('textchange', ({ text, length, max, source }) => {
    if (source === 'program') {
      hasInteracted = text !== '';
      writeDisplay(text);
    }
    if (counter) counter.textContent = `${length}/${max} characters`;
  });

  // Caret thickness + rounding are config-driven (settings → Cursor). Push them to
  // CSS vars the ::after caret reads; `rounding` (0–1) maps to a radius of up to
  // half the thickness (1 = capsule). Re-applied live on every config change.
  const applyCursor = () => {
    const c = engine.config.cursor;
    const thickness = c?.thickness ?? 0.105;
    const rounding = c?.rounding ?? 0.35;
    textDisplay.style.setProperty('--ok-caret-thickness', `${thickness}em`);
    textDisplay.style.setProperty('--ok-caret-radius', `${(rounding * thickness) / 2}em`);
  };
  applyCursor();
  const offConfig = engine.on('config', applyCursor);

  // Initial state
  writeDisplay(engine.currentText || '');
  if (counter) counter.textContent = `${(engine.currentText || '').length}/${maxChars()} characters`;

  // Desktop: focus the field on load so it's the live input immediately — typing
  // (incl. space + Enter) goes straight into the real contenteditable with a caret,
  // no click required. While empty it keeps the big invite caret (data-placeholder
  // hides the native caret) until the first character. Mobile skips this so the soft
  // keyboard doesn't pop on load (it focuses via tap-to-type instead).
  if (!isMobile()) {
    const autofocus = () => {
      if (!hasInteracted && document.activeElement !== textDisplay) {
        textDisplay.focus({ preventScroll: true });
      }
    };
    autofocus();
    // Belt-and-suspenders if something grabbed focus during init (deferred, not rAF —
    // which is throttled when the tab/preview is backgrounded).
    setTimeout(autofocus, 0);
  }

  return () => {
    offTextChange();
    offConfig();
  };
};
