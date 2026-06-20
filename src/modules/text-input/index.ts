/**
 * text-input — the editable phrase field(s), the live character counter, the clear
 * button, and "type anywhere" capture. Drives the engine and reflects program changes.
 *
 * Caret rule: on user keystrokes we DON'T rewrite the contenteditable's textContent
 * (that collapses the caret) — only program/animation changes (engine `textchange`
 * with source 'program') write the text back.
 */
import type { OpenKeysModule } from '../../core/types';
import './style.css';

const PLACEHOLDER = 'type something…';

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) || host.querySelector<HTMLElement>(`#${id}`);
}

export const textInput: OpenKeysModule = ({ engine, host, signal }) => {
  const textDisplay = resolve(host, 'text-display', 'textDisplay');
  const mobileDisplay = resolve(host, 'mobile-text-display', 'mobileTextDisplay');
  const counter = resolve(host, 'character-count', 'characterCount');
  const clearBtn = resolve(host, 'clear-button', 'clearButton');
  const displays = [textDisplay, mobileDisplay].filter(Boolean) as HTMLElement[];
  if (!displays.length) return () => {};

  const maxChars = () => engine.config.features.maxCharacters;
  let hasInteracted = false;
  let isUpdating = false;

  const setPlaceholderAttr = (el: HTMLElement, on: boolean) => {
    if (on) el.setAttribute('data-placeholder', 'true');
    else el.removeAttribute('data-placeholder');
  };

  /** Write the editable text + placeholder state to the display nodes. */
  const writeDisplay = (text: string, skipTextWrite = false) => {
    const isPlaceholder = !hasInteracted && !text;
    const shown = isPlaceholder ? PLACEHOLDER : text;
    displays.forEach((el) => {
      if (!skipTextWrite) el.textContent = shown;
      setPlaceholderAttr(el, isPlaceholder);
    });
  };

  const setCursorToEnd = (element: HTMLElement, position?: number) => {
    try {
      const range = document.createRange();
      const selection = window.getSelection();
      if (element.childNodes.length > 0) {
        const node = element.childNodes[0];
        const len = node.textContent?.length || 0;
        const pos = position !== undefined ? Math.min(position, len) : len;
        range.setStart(node, pos);
        range.setEnd(node, pos);
      } else {
        range.setStart(element, 0);
        range.setEnd(element, 0);
      }
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch {
      /* ignore caret errors */
    }
  };

  const getDisplayText = (): string => {
    const text = textDisplay?.textContent?.trim() || mobileDisplay?.textContent?.trim() || '';
    return hasInteracted ? text : '';
  };

  /** Apply text from a non-focused path (type-anywhere / programmatic): writes display + drives engine. */
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

  // --- Focused editing on the contenteditable nodes ---
  const handleInput = (element: HTMLElement) => {
    if (isUpdating) return;
    const text = element.textContent || '';
    if (!hasInteracted && text.trim()) hasInteracted = true;

    if (text.length > maxChars()) {
      const sel = window.getSelection();
      const cursor = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startOffset : 0;
      const truncated = text.slice(0, maxChars());
      element.textContent = truncated;
      setCursorToEnd(element, Math.min(cursor, truncated.length));
      applyText(truncated); // rewrite + drive
      return;
    }
    // Normal typing: don't rewrite textContent (preserve caret), just drive the engine.
    applyText(text, true);
  };

  displays.forEach((element) => {
    element.addEventListener('input', () => handleInput(element), { signal });
    element.addEventListener(
      'focus',
      () => {
        if (!hasInteracted) {
          element.textContent = '';
          writeDisplay('');
        }
      },
      { signal }
    );
    element.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      },
      { signal }
    );
    element.addEventListener(
      'paste',
      (e: ClipboardEvent) => {
        e.preventDefault();
        const clean = (e.clipboardData?.getData('text') || '').replace(/\n/g, ' ').trim();
        if (!hasInteracted) {
          hasInteracted = true;
          element.textContent = '';
        }
        const isMobile = window.innerWidth <= engine.config.scene.mobileBreakpoint;
        if (isMobile && element === mobileDisplay) {
          element.textContent = ((element.textContent || '') + clean).slice(0, maxChars());
        } else {
          const sel = window.getSelection();
          if (!sel) return;
          const cursor = sel.getRangeAt(0).startOffset;
          const cur = element.textContent || '';
          element.textContent = (cur.slice(0, cursor) + clean + cur.slice(cursor)).slice(0, maxChars());
        }
        applyText(element.textContent || '');
      },
      { signal }
    );
  });

  // --- Type anywhere (when no field is focused and no modal is open) ---
  const isInputFocused = () =>
    document.activeElement?.tagName === 'INPUT' ||
    document.activeElement?.tagName === 'TEXTAREA' ||
    textDisplay?.matches(':focus') ||
    mobileDisplay?.matches(':focus');
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
      // Mobile space inserts a space; desktop space is reserved for the poster trigger.
      if ((key === ' ' || e.code === 'Space') && window.innerWidth <= engine.config.scene.mobileBreakpoint) {
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
  engine.on('textchange', ({ text, length, max, source }) => {
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
    /* listeners removed via the shared AbortSignal */
  };
};
