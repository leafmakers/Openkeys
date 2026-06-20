/**
 * text-input — the single editable phrase field, the live character counter, the
 * clear button, "type anywhere" capture (desktop), and mobile tap-to-type.
 *
 * One field, two anchors: the same #textDisplay is a top card on desktop and a
 * bottom dock on mobile (positioned by base.css). On touch devices there's no
 * physical keyboard, so document-level keydown ("type anywhere") never fires —
 * instead a tap on the 3D canvas focuses the field and raises the soft keyboard,
 * and a visualViewport listener lifts the dock above that keyboard (--kb-inset).
 *
 * Caret rule: on user keystrokes we DON'T rewrite the contenteditable's textContent
 * (that collapses the caret) — only program/animation changes (engine `textchange`
 * with source 'program') write the text back.
 */
import type { OpenKeysModule } from '../../core/types';
import './style.css';

const isCoarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const PLACEHOLDER = isCoarsePointer ? 'Tap to type…' : 'type something…';

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

  const getDisplayText = (): string => {
    const text = textDisplay.textContent?.trim() || '';
    return hasInteracted ? text : '';
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
    'focus',
    () => {
      // Clear the placeholder to a genuinely empty field — do NOT route through
      // writeDisplay() here, or it would re-insert PLACEHOLDER as editable text.
      if (!hasInteracted) {
        textDisplay.textContent = '';
        setPlaceholderAttr(false);
      }
    },
    { signal }
  );
  textDisplay.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
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

  // --- Type anywhere (desktop hardware keyboard; mobile has no keydowns until focus) ---
  const isInputFocused = () => {
    const a = document.activeElement;
    return a?.tagName === 'INPUT' || a?.tagName === 'TEXTAREA' || (a as HTMLElement)?.isContentEditable === true;
  };
  const isModalOpen = () => document.getElementById('previewModal')?.style.display === 'block';

  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (isInputFocused() || isModalOpen()) return;
      const key = e.key.toLowerCase();
      const current = getDisplayText();

      if (e.key === 'Backspace') {
        if (current) applyText(current.slice(0, -1));
        return;
      }
      // Mobile space (with a hardware keyboard) inserts a space; desktop space is the poster trigger.
      if ((key === ' ' || e.code === 'Space') && isMobile()) {
        e.preventDefault();
        if (current.length < maxChars()) {
          hasInteracted = true;
          applyText(current ? current + ' ' : ' ');
        }
        return;
      }
      if (engine.hasKey(key) && current.length < maxChars()) {
        hasInteracted = true;
        applyText(current + key);
      }
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
      // Only a quick, near-stationary tap counts — a drag is an orbit gesture, leave it alone.
      if (moved < 10 && performance.now() - downT < 500) {
        textDisplay.focus({ preventScroll: true });
        setCursorToEnd();
      }
    },
    { signal }
  );

  // --- Lift the bottom dock above the soft keyboard (mobile) ---
  const vv = window.visualViewport;
  if (vv) {
    const onViewport = () => {
      const inset = window.innerHeight - vv.height - vv.offsetTop;
      document.documentElement.style.setProperty('--kb-inset', inset > 40 ? `${Math.round(inset)}px` : '0px');
    };
    vv.addEventListener('resize', onViewport, { signal });
    vv.addEventListener('scroll', onViewport, { signal });
  }

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

  // Initial state
  writeDisplay(engine.currentText || '');
  if (counter) counter.textContent = `${(engine.currentText || '').length}/${maxChars()} characters`;

  return () => {
    offTextChange();
    document.documentElement.style.removeProperty('--kb-inset');
  };
};
