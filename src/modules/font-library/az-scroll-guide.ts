/**
 * az-scroll-guide — the A–Z quick-jump rail beside the font list. Wires the
 * letter buttons to scroll the list to each letter section and keeps the active
 * letter highlighted as the user scrolls. Module-private to font-library.
 *
 * Letter sections (`.font-letter-section[data-letter]`) are sticky-positioned, so
 * getting an accurate `offsetTop` means briefly forcing `position: static`.
 */
export interface AzScrollGuide {
  /** Enable buttons for letters that have fonts; disable the rest. */
  setAvailableLetters(letters: Set<string>): void;
}

export function createAzScrollGuide(
  guide: HTMLElement | null,
  list: HTMLElement | null,
  signal: AbortSignal
): AzScrollGuide {
  if (!guide || !list) {
    return { setAvailableLetters() {} };
  }

  const sectionFor = (letter: string) =>
    list.querySelector<HTMLElement>(`.font-letter-section[data-letter="${letter}"]`);

  const jumpToLetter = (letter: string) => {
    const section = sectionFor(letter);
    if (!section) return;

    // Briefly un-stick to read the true offset, then restore.
    const originalPosition = section.style.position;
    section.style.position = 'static';
    void section.offsetHeight;
    const targetPosition = section.offsetTop;
    section.style.position = originalPosition;

    const containerPadding = 12; // matches .font-drawer-list padding-top
    const maxScroll = list.scrollHeight - list.clientHeight;
    const finalScroll = Math.min(Math.max(0, targetPosition - containerPadding), maxScroll);

    list.scrollTop = finalScroll;
    requestAnimationFrame(() => {
      if (Math.abs(list.scrollTop - finalScroll) > 1) list.scrollTop = finalScroll;
      updateActiveLetter();
    });
  };

  const updateActiveLetter = () => {
    const sections = Array.from(list.querySelectorAll<HTMLElement>('.font-letter-section'));
    const currentScrollTop = list.scrollTop;
    const ACTIVATION_THRESHOLD = 100;

    let activeLetter = '';
    sections.forEach((section) => {
      const originalPosition = section.style.position;
      section.style.position = 'static';
      const offset = section.offsetTop;
      section.style.position = originalPosition;
      if (offset <= currentScrollTop + ACTIVATION_THRESHOLD) {
        activeLetter = section.getAttribute('data-letter') || '';
      }
    });

    guide.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-letter') === activeLetter);
    });
  };

  // Wire letter buttons.
  guide.querySelectorAll('button').forEach((button) => {
    button.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        const letter = button.getAttribute('data-letter');
        if (!letter || (button as HTMLButtonElement).disabled) return;
        guide.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        button.classList.add('active');
        jumpToLetter(letter);
      },
      { signal }
    );
  });

  // Throttled scroll → active-letter tracking.
  let scrollTimeout: number | undefined;
  list.addEventListener(
    'scroll',
    () => {
      if (scrollTimeout) window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(updateActiveLetter, 50);
    },
    { passive: true, signal }
  );

  return {
    setAvailableLetters(letters) {
      guide.querySelectorAll('button').forEach((btn) => {
        const letter = btn.getAttribute('data-letter');
        (btn as HTMLButtonElement).disabled = !(letter && letters.has(letter));
      });
    },
  };
}
