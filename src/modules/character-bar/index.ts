/**
 * character-bar — renders the per-letter frequency bar beneath the text input.
 * Listens to the engine's `data` event (mode-aware counts) and `theme` (to recolor
 * the "others" segment). Owns the `[data-ok-role="character-bar-segments"]` element.
 */
import type { OpenKeysModule } from '../../core/types';
import { getCharacterFillColor, calculateMaxCharactersForWidth } from '../../shared/char-color';
import './style.css';

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) || host.querySelector<HTMLElement>(`#${id}`);
}

export const characterBar: OpenKeysModule = ({ engine, host }) => {
  const segments = resolve(host, 'character-bar-segments', 'characterBarSegments');
  if (!segments) return () => {};

  let dark = engine.themeMode === 'dark';
  let lastCounts: Record<string, number> = {};

  const addSegment = (char: string, count: number, isFirst: boolean, isLast: boolean) => {
    const segment = document.createElement('div');
    segment.className = 'bar-segment';
    segment.style.flexGrow = String(count);
    segment.style.background = getCharacterFillColor(char, count);
    if (isFirst) {
      segment.style.borderTopLeftRadius = '4px';
      segment.style.borderBottomLeftRadius = '4px';
    }
    if (isLast) {
      segment.style.borderTopRightRadius = '4px';
      segment.style.borderBottomRightRadius = '4px';
    }
    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = `${char} (${count})`;
    const line = document.createElement('div');
    line.className = 'bar-line';
    segment.appendChild(line);
    segment.appendChild(label);
    segments.appendChild(segment);
  };

  const addOthers = (count: number) => {
    const segment = document.createElement('div');
    segment.className = 'bar-segment';
    segment.style.flexGrow = String(count);
    segment.style.background = dark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
    segment.style.borderTopRightRadius = '4px';
    segment.style.borderBottomRightRadius = '4px';
    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = `others (${count})`;
    const line = document.createElement('div');
    line.className = 'bar-line';
    segment.appendChild(line);
    segment.appendChild(label);
    segments.appendChild(segment);
  };

  const render = (counts: Record<string, number>) => {
    lastCounts = counts;
    segments.innerHTML = '';
    const entries = Object.entries(counts).filter(([, c]) => c > 0);
    if (!entries.length) return;
    const maxChars = calculateMaxCharactersForWidth(window.innerWidth);
    const sorted = entries.sort(([, a], [, b]) => b - a);
    const shown = sorted.slice(0, maxChars);
    const others = sorted.slice(maxChars).reduce((sum, [, c]) => sum + c, 0);
    shown.forEach(([char, count], i) =>
      addSegment(char, count, i === 0, i === shown.length - 1 && others === 0)
    );
    if (others > 0) addOthers(others);
  };

  const offData = engine.on('data', ({ counts }) => render(counts));
  const offTheme = engine.on('theme', ({ mode }) => {
    dark = mode === 'dark';
    render(lastCounts); // recolor the "others" segment
  });

  return () => {
    offData();
    offTheme();
    segments.innerHTML = '';
  };
};
