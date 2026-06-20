/**
 * typing-speed — live words-per-minute readout. Computes WPM from real user
 * keystrokes (textchange{source:'user'}), resetting when the text is cleared.
 * Owns the `[data-ok-role="typing-speed"]` element.
 */
import type { OpenKeysModule } from '../../core/types';
import './style.css';

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) || host.querySelector<HTMLElement>(`#${id}`);
}

export const typingSpeed: OpenKeysModule = ({ engine, host }) => {
  const el = resolve(host, 'typing-speed', 'typingSpeed');
  if (!el) return () => {};

  let startTime: number | null = null;
  let isTyping = false;
  let wpm = 0;

  const paint = () => {
    el.textContent = `${wpm} WPM`;
    el.style.color = wpm > 60 ? '#4CAF50' : wpm > 30 ? '#FFC107' : '#F44336';
  };

  const reset = () => {
    startTime = null;
    isTyping = false;
    wpm = 0;
    paint();
  };

  const off = engine.on('textchange', ({ text, source }) => {
    if (source !== 'user') return; // WPM tracks human typing only
    if (!text) {
      reset();
      return;
    }
    const now = performance.now();
    if (!isTyping) {
      startTime = now;
      isTyping = true;
    }
    if (startTime !== null) {
      const minutes = (now - startTime) / 60000;
      wpm = Math.round(text.length / 5 / Math.max(0.1, minutes));
    }
    paint();
  });

  paint();
  return () => {
    off();
  };
};
