/**
 * character-bar — renders the per-letter frequency bar beneath the text input.
 * Listens to the engine's `data` event (mode-aware counts) and `theme` (to recolor
 * the "others" segment). Owns the `[data-ok-role="character-bar-segments"]` element.
 */
import type { OpenKeysModule } from '../../core/types';
import {
  getCharacterFillColor,
  getOthersFillColor,
  calculateMaxCharactersForWidth,
} from '../../shared/char-color';
import './style.css';

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) || host.querySelector<HTMLElement>(`#${id}`);
}

export const characterBar: OpenKeysModule = ({ engine, host }) => {
  const segments = resolve(host, 'character-bar-segments', 'characterBarSegments');
  if (!segments) return () => {};

  let dark = engine.themeMode === 'dark';
  let lastCounts: Record<string, number> = {};
  /** keyId → its segment + colour, so a 3D-key hover can find its segment. */
  const keyFills = new Map<string, { el: HTMLElement; fill: string }>();
  /** Segment currently marked from a 3D-key hover (so we can un-mark it). */
  let hoveredSeg: HTMLElement | null = null;

  /** One frequency segment — uniform rounding + gaps come from CSS. */
  const addSegment = (label: string, count: number, fill: string, keyId?: string) => {
    const segment = document.createElement('div');
    segment.className = 'bar-segment';
    segment.style.flexGrow = String(count);
    // The color drives the ::before fill layer (not the segment background) so the
    // bar can grow on hover without scaling the label/tick. See style.css.
    segment.style.setProperty('--bar-fill', fill);

    const tick = document.createElement('div');
    tick.className = 'bar-line';
    const tag = document.createElement('div');
    tag.className = 'bar-label';
    tag.textContent = `${label} (${count})`;
    segment.appendChild(tick);
    segment.appendChild(tag);

    // Keep the tooltip just left of the pointer instead of directly beneath it.
    // When the matching 3D key drives the hover, CSS falls back to the segment's
    // midpoint because there is no pointer position over the bar to follow.
    segment.addEventListener('pointermove', (event) => {
      const rect = segment.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const gap = 7;
      const labelWidth = tag.offsetWidth;
      // Preserve a small viewport gutter at the far-left edge by flipping only
      // when needed. The connector and label consume this same center point.
      const placeRight = event.clientX - labelWidth - gap < 8;
      const center = placeRight
        ? x + gap + labelWidth / 2
        : x - gap - labelWidth / 2;
      segment.style.setProperty('--bar-label-center-x', `${center}px`);
    });
    segment.addEventListener('pointerleave', () => {
      segment.style.removeProperty('--bar-label-center-x');
    });

    // Hover spotlight, both ways: hovering the segment tints the matching 3D key,
    // and (via the engine's `hover` event) hovering the 3D key marks this segment.
    // The aggregate "others" segment maps to no single key, so it isn't wired.
    if (keyId) {
      segment.classList.add('bar-segment--key');
      keyFills.set(keyId, { el: segment, fill });
      segment.addEventListener('mouseenter', () => {
        if (engine.config.features.hoverHighlight) engine.highlightKey(keyId, fill);
      });
      segment.addEventListener('mouseleave', () => engine.clearHighlight());
    }

    segments.appendChild(segment);
  };

  const render = (counts: Record<string, number>) => {
    engine.clearHighlight(); // a hovered segment may be getting destroyed
    keyFills.clear();
    hoveredSeg = null;
    lastCounts = counts;
    segments.innerHTML = '';
    const entries = Object.entries(counts).filter(([, c]) => c > 0);
    if (!entries.length) return;
    const maxChars = calculateMaxCharactersForWidth(window.innerWidth);
    const sorted = entries.sort(([, a], [, b]) => b - a);
    const shown = sorted.slice(0, maxChars);
    const others = sorted.slice(maxChars).reduce((sum, [, c]) => sum + c, 0);
    shown.forEach(([char, count], i) => addSegment(char, count, getCharacterFillColor(i), char));
    if (others > 0) addSegment('others', others, getOthersFillColor(dark));
  };

  // Reverse direction: a 3D-key hover marks its bar segment and tints the key in
  // the segment's colour. The engine already cleared any prior highlight before
  // emitting, so we only ever ADD here (never clear) — no stomping the delete-key
  // red the engine owns.
  const onHover = ({ keyId }: { keyId: string | null }) => {
    if (hoveredSeg) {
      hoveredSeg.classList.remove('is-hovered');
      hoveredSeg = null;
    }
    if (!keyId || !engine.config.features.hoverHighlight) return;
    const entry = keyFills.get(keyId);
    if (!entry) return;
    entry.el.classList.add('is-hovered');
    hoveredSeg = entry.el;
    engine.highlightKey(keyId, entry.fill);
  };

  const offData = engine.on('data', ({ counts }) => render(counts));
  const offTheme = engine.on('theme', ({ mode }) => {
    dark = mode === 'dark';
    render(lastCounts); // recolor the "others" segment
  });
  const offHover = engine.on('hover', onHover);

  return () => {
    offData();
    offTheme();
    offHover();
    engine.clearHighlight();
    segments.innerHTML = '';
  };
};
