/**
 * sample-phrase — the navbar "fox" button. Each click animates a pangram into the
 * keyboard (engine.typeText resets the board and types from scratch), so every
 * letter a–z gets a turn and the whole skyline rises. Clicks cycle through the
 * list, so repeated taps show different phrases.
 */
import type { OpenKeysModule } from '../../core/types';
import './style.css';

/** Pangrams — each contains every letter a–z at least once. */
const PHRASES = [
  'the quick brown fox jumps over the lazy dog',
  'pack my box with five dozen liquor jugs',
  'how vexingly quick daft zebras jump',
  'sphinx of black quartz, judge my vow',
  'the five boxing wizards jump quickly',
];

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) || host.querySelector<HTMLElement>(`#${id}`);
}

export const samplePhrase: OpenKeysModule = ({ engine, host, signal }) => {
  const btn = resolve(host, 'sample-phrase', 'samplePhrase');
  if (!btn) return () => {};

  let index = 0;
  let typing = false;

  btn.addEventListener(
    'click',
    async () => {
      if (typing) return; // ignore clicks while a phrase is still typing
      typing = true;
      btn.classList.add('is-typing');
      const phrase = PHRASES[index % PHRASES.length];
      index++;
      try {
        await engine.typeText(phrase);
      } catch {
        /* engine errors are already logged in the loop */
      } finally {
        typing = false;
        btn.classList.remove('is-typing');
      }
    },
    { signal }
  );

  return () => {};
};
