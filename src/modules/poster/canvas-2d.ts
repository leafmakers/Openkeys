/**
 * Module-private 2D poster renderer. Composites the force-rendered WebGL frame
 * (passed in as a data URL from engine.exportImage(), so it's never blank) with
 * a typographic overlay: the phrase as a title, a stats line, and the character
 * frequency bar. Pure functions — no engine/DOM-internals reach-ins.
 */
import { getCharacterFillColor, getOthersFillColor, calculateMaxCharactersForWidth } from '../../shared/char-color';

export interface PosterInput {
  /** Force-rendered scene as a PNG data URL (engine.exportImage()). */
  imageDataUrl: string;
  /** The phrase to typeset. */
  text: string;
  /** Resolved keycap font (poster title). Caller degrades a null activeFont to System. */
  font: { family: string; name: string };
  /** Whether to use dark-on-light or light-on-dark overlay colors. */
  isDark: boolean;
  /** Which characters count toward the stats/bar (engine.hasKey). */
  hasKey: (ch: string) => boolean;
  /** Title typography from the poster controls (the font family stays the keycap font). */
  typography?: PosterTypography;
}

/** Live, poster-only title type adjustments (not the font family — that's the keycap font). */
export interface PosterTypography {
  /** Title size multiplier over the auto-fit default (1 = default). */
  size: number;
  /** Title font weight (100–900). */
  weight: number;
  /** Letter-spacing as a fraction of the title size (em); 0 = none. */
  letterSpacing: number;
  /** Line-height as a multiple of the title size. */
  lineHeight: number;
}

/** Defaults that reproduce the original poster look. */
export const DEFAULT_POSTER_TYPOGRAPHY: PosterTypography = {
  size: 1,
  weight: 500,
  letterSpacing: 0,
  lineHeight: 1,
};

/** Build the composited poster as a canvas. Async because the WebGL frame loads via an Image. */
export function generatePoster(input: PosterInput): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        const width = img.naturalWidth;
        const height = img.naturalHeight;
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        if (input.text) drawPosterText(ctx, input, width, height);

        resolve(canvas);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load rendered scene for poster'));
    img.src = input.imageDataUrl;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill = false,
  stroke = true
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

interface PosterLayout {
  margin: { side: number; top: number };
  title: { fontSize: number; color: string; lineHeight: number; maxWidth: number; weight: number; letterSpacing: number };
  /** ONE metadata type style, shared by the caption and every bar label — the
   *  whole fix for the inconsistency is that nothing here resizes per-element. */
  meta: { size: number; color: string; muted: string };
  bar: { height: number; bottomMargin: number };
}

function drawPosterText(
  ctx: CanvasRenderingContext2D,
  input: PosterInput,
  width: number,
  height: number
): void {
  const isMobile = window.innerWidth <= 480;

  const typo = input.typography ?? DEFAULT_POSTER_TYPOGRAPHY;

  const sideMargin = Math.max(24, Math.min(120, Math.min(width, height) * 0.08));
  const topMargin = Math.max(48, Math.min(180, Math.min(width, height) * 0.13));
  const maxWidth = width - sideMargin * 2;

  // Auto-fit the headline: start at an ideal size and shrink until the wrapped
  // phrase fits within MAX_LINES. This is what makes the poster well-composed out
  // of the box for ANY phrase length — short phrases read big, long ones shrink to
  // fit instead of clipping or sprawling into the keyboard.
  const MAX_LINES = 3;
  const idealSize = Math.max(40, Math.min(132, Math.min(width, height) * 0.092));
  const minSize = Math.max(26, idealSize * 0.42);
  const measureLineCount = (size: number): number => {
    ctx.font = `${typo.weight} ${Math.round(size)}px ${input.font.family}`;
    (ctx as any).letterSpacing = `${typo.letterSpacing * size}px`;
    return getTextLines(input.text.split(' '), ctx, maxWidth).length;
  };
  let fitSize = idealSize;
  while (fitSize > minSize && measureLineCount(fitSize) > MAX_LINES) fitSize -= 2;

  // The Size slider scales the fitted base (1 = the auto-fit ideal); the supporting
  // stats/labels track the fitted base so only the headline grows when tuned.
  const titleSize = fitSize * typo.size;
  // ONE metadata type size for the caption AND every bar label — consistency by
  // construction. Nothing in the footer resizes per-element.
  const metaSize = Math.round(Math.max(13, Math.min(24, fitSize * 0.24)));

  const layout: PosterLayout = {
    margin: { side: sideMargin, top: topMargin },
    title: {
      fontSize: titleSize,
      color: input.isDark ? '#ffffff' : '#000000',
      lineHeight: Math.round(titleSize * typo.lineHeight),
      maxWidth,
      weight: typo.weight,
      letterSpacing: typo.letterSpacing * titleSize, // em → px
    },
    meta: {
      size: metaSize,
      color: input.isDark ? '#ededed' : '#1c1c1c',
      muted: input.isDark ? '#8c8c8c' : '#9a9a9a',
    },
    bar: {
      // The bar sits high enough that the caption (above) and the uniform labels
      // (below) both clear the edges — the footer reads as one balanced block.
      height: isMobile ? 22 : 30,
      bottomMargin: isMobile ? 116 : 172,
    },
  };

  drawTitle(ctx, input, layout);
  drawFooter(ctx, input, layout, width, height);
}

function drawTitle(ctx: CanvasRenderingContext2D, input: PosterInput, layout: PosterLayout): number {
  const fontSize = Math.round(layout.title.fontSize);
  ctx.font = `${layout.title.weight} ${fontSize}px ${input.font.family}`;
  // letterSpacing must be set before measuring so wrapping accounts for the kerning.
  (ctx as any).letterSpacing = `${layout.title.letterSpacing}px`;
  ctx.fillStyle = layout.title.color;
  ctx.textAlign = 'left';
  // Anchor by the TOP of the first line (not the alphabetic baseline) so the
  // headline's first line can never bleed above the top margin, whatever the
  // font's ascent or the chosen size.
  ctx.textBaseline = 'top';

  const words = input.text.split(' ');
  const lines = getTextLines(words, ctx, layout.title.maxWidth);

  let currentY = layout.margin.top;
  lines.forEach((line) => {
    ctx.fillText(line, layout.margin.side, currentY);
    currentY += layout.title.lineHeight;
  });
  (ctx as any).letterSpacing = '0px'; // reset so stats/bar use normal spacing
  ctx.textBaseline = 'alphabetic'; // reset baseline for stats/bar
  return currentY;
}

function getTextLines(words: string[], ctx: CanvasRenderingContext2D, maxWidth: number): string[] {
  const lines: string[] = [];
  let currentLine = '';
  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Footer: a single consistent metadata caption + the frequency bar, with ONE
 * uniform label size for every segment. Caption and labels share layout.meta —
 * nothing resizes per-element, which is the whole fix for the inconsistency.
 * Hierarchy: the hero headline (keycap font) over quiet, uniform metadata.
 */
function drawFooter(
  ctx: CanvasRenderingContext2D,
  input: PosterInput,
  layout: PosterLayout,
  width: number,
  height: number
): void {
  const side = layout.margin.side;
  const meta = layout.meta;
  const barWidth = width - side * 2;
  const barHeight = layout.bar.height;
  const barTop = height - layout.bar.bottomMargin;

  const counts: Record<string, number> = {};
  input.text.toLowerCase().split('').forEach((c) => {
    if (/[a-z0-9]/.test(c)) counts[c] = (counts[c] || 0) + 1;
  });
  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  const unique = Object.keys(counts).length;

  // Caption above the bar — muted, uppercase, tracked. One style, two ends.
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${meta.size}px system-ui, sans-serif`;
  (ctx as any).letterSpacing = '0.06em';
  ctx.fillStyle = meta.muted;
  const captionY = barTop - Math.round(meta.size * 1.5);
  ctx.textAlign = 'left';
  ctx.fillText(`${total} CHARACTERS · ${unique} UNIQUE`, side, captionY);
  ctx.textAlign = 'right';
  ctx.fillText(`SET IN ${input.font.name.toUpperCase()}`, width - side, captionY);
  (ctx as any).letterSpacing = '0px';

  if (total === 0) return;

  // Proportional segments + uniform labels centred below each.
  const maxChars = Math.min(calculateMaxCharactersForWidth(width), 8);
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const shown = sorted.slice(0, maxChars);
  const othersCount = sorted.slice(maxChars).reduce((s, [, c]) => s + c, 0);

  const segments: Array<{ label: string; count: number; color: string }> = shown.map(
    ([char, count], i) => ({ label: char, count, color: getCharacterFillColor(i) })
  );
  if (othersCount > 0) {
    segments.push({ label: 'others', count: othersCount, color: getOthersFillColor(input.isDark) });
  }

  const gap = Math.max(3, Math.round(barHeight * 0.24));
  const radius = Math.min(Math.round(barHeight * 0.34), 9);
  const labelY = barTop + barHeight + Math.round(meta.size * 1.35);
  const labelGap = Math.round(meta.size * 0.7);

  ctx.font = `600 ${meta.size}px system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  let x = side;
  let lastLabelRight = -Infinity;
  for (const seg of segments) {
    const segW = (seg.count / total) * barWidth;
    if (segW <= 0) continue;
    drawBarSegment(ctx, x, barTop, segW, barHeight, gap, radius, seg.color);

    // Uniform label, centred under the segment. SKIP (never shrink) when it would
    // collide with the previous one — clean collision avoidance, one size always.
    const text = `${seg.label} ${seg.count}`;
    const tw = ctx.measureText(text).width;
    const cx = x + segW / 2;
    if (cx - tw / 2 > lastLabelRight + labelGap) {
      ctx.fillStyle = meta.color;
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, labelY);
      lastLabelRight = cx + tw / 2;
    }
    x += segW;
  }
}

/** One frequency segment: a gap-inset, uniformly-rounded solid chip. */
function drawBarSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  gap: number,
  radius: number,
  fill: string
): void {
  const innerWidth = Math.max(width - gap, 2);
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  roundRect(ctx, x + gap / 2, y, innerWidth, height, Math.min(radius, innerWidth / 2), false, false);
  ctx.fill();
  ctx.restore();
}

