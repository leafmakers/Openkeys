/**
 * poster — the "Preview Poster" flow: a lazy modal that composites the rendered
 * scene with a typographic overlay (title / stats / character bar) and lets the
 * user download it as a PNG.
 *
 * Capture rule: the scene is grabbed ONLY through engine.exportImage(), which
 * force-renders before reading pixels — so the poster is never blank even if the
 * loop is paused. The title font comes from engine.activeFont (degrading to
 * "System" when no keycap font has been chosen).
 */
import type { OpenKeysModule } from '../../core/types';
import { generatePoster } from './canvas-2d';
import { showToast } from '../../shared/toast';
import './style.css';

const SYSTEM_FONT = { family: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', name: 'System' };

function resolve(host: HTMLElement, role: string, id: string): HTMLElement | null {
  return (
    host.querySelector<HTMLElement>(`[data-ok-role="${role}"]`) ||
    host.querySelector<HTMLElement>(`#${id}`)
  );
}

export const poster: OpenKeysModule = ({ engine, host, signal }) => {
  const trigger = resolve(host, 'poster-trigger', 'previewAndPrint');
  const modal = resolve(host, 'poster-modal', 'previewModal');
  const image = resolve(host, 'poster-image', 'previewImage') as HTMLImageElement | null;
  const closeBtn = resolve(host, 'poster-close', 'closePreview');
  const printBtn = resolve(host, 'poster-print', 'printFromPreview');

  const isOpen = () => modal?.style.display === 'block';

  const buildCanvas = () =>
    generatePoster({
      imageDataUrl: engine.exportImage(),
      text: engine.currentText,
      font: engine.activeFont ?? SYSTEM_FONT,
      isDark: engine.themeMode === 'dark',
      hasKey: (ch) => engine.hasKey(ch),
    });

  const showPreview = async () => {
    if (!modal || !image) return;
    try {
      const canvas = await buildCanvas();
      image.src = canvas.toDataURL('image/png');
      modal.style.display = 'block';
    } catch (err) {
      console.error('Error generating preview:', err);
      showToast('Failed to generate preview. Please try again.');
    }
  };

  const hidePreview = () => {
    if (modal) modal.style.display = 'none';
  };

  const downloadPoster = async () => {
    try {
      const canvas = await buildCanvas();
      const prefix = engine.config.branding.posterFilenamePrefix || 'openkeys';
      const slug = engine.currentText
        ? `-${engine.currentText.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}`
        : '';
      const fileName = `${prefix}-poster${slug}.png`;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Poster downloaded successfully!', false);
      }, 'image/png', 1.0);
    } catch (err) {
      console.error('Error downloading poster:', err);
      showToast('Failed to download poster. Please try again.');
    }
  };

  // --- Visibility: gated by the live config.features.poster flag ---
  const applyVisibility = () => {
    if (trigger) trigger.style.display = engine.config.features.poster ? '' : 'none';
  };
  applyVisibility();
  const offConfig = engine.on('config', applyVisibility);

  // --- Trigger + modal controls ---
  trigger?.addEventListener('click', () => void showPreview(), { signal });
  closeBtn?.addEventListener('click', hidePreview, { signal });
  printBtn?.addEventListener('click', () => void downloadPoster(), { signal });
  modal?.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (e.target === modal) hidePreview();
    },
    { signal }
  );

  // --- Keyboard shortcuts ---
  const isInputFocused = () => {
    const a = document.activeElement;
    return a?.tagName === 'INPUT' || a?.tagName === 'TEXTAREA' || (a as HTMLElement)?.isContentEditable === true;
  };

  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (!engine.config.features.poster) return;
      // Escape closes an open poster.
      if (e.key === 'Escape' && isOpen()) {
        e.preventDefault();
        hidePreview();
        return;
      }
      // Ctrl+Enter previews from anywhere.
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        void showPreview();
        return;
      }
      // Space previews on desktop when not typing and nothing is open.
      if (
        (e.key === ' ' || e.code === 'Space') &&
        !isInputFocused() &&
        !isOpen() &&
        window.innerWidth > engine.config.scene.mobileBreakpoint
      ) {
        e.preventDefault();
        void showPreview();
      }
    },
    { signal }
  );

  return () => {
    offConfig();
    hidePreview();
  };
};
