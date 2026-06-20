/**
 * theme-toggle — the navbar light/dark button. It only flips the engine theme;
 * page-chrome (body background, <html data-theme>, localStorage) is owned by the
 * app bootstrap so the theme still applies when this button is disabled.
 */
import type { OpenKeysModule } from '../../core/types';
import './style.css';

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) || host.querySelector<HTMLElement>(`#${id}`);
}

export const themeToggle: OpenKeysModule = ({ engine, host, signal }) => {
  const btn = resolve(host, 'theme-toggle', 'themeToggle');
  if (!btn) return () => {};

  // Disabled via config → hide the button and do nothing else.
  if (!engine.config.features.themeToggle) {
    btn.classList.add('hidden');
    return () => {};
  }

  btn.addEventListener(
    'click',
    () => engine.setTheme(engine.themeMode === 'dark' ? 'light' : 'dark'),
    { signal }
  );

  return () => {};
};
