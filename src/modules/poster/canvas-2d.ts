/**
 * Module-private 2D poster renderer. Composites the force-rendered WebGL frame
 * (passed in as a data URL from engine.exportImage(), so it's never blank) with
 * a typographic overlay: the phrase as a title, a stats line, and the character
 * frequency bar. Pure functions — no engine/DOM-internals reach-ins.
 */
import { getCharacterFillColor, calculateMaxCharactersForWidth } from '../../shared/char-color';

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
}

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
  title: { fontSize: number; color: string; lineHeight: number; maxWidth: number };
  stats: { font: string; fontSize: number; color: string; spacing: number };
  bar: { height: number; spacing: number; labelFont: string; bottomMargin: number; lineHeight: number };
}

function drawPosterText(
  ctx: CanvasRenderingContext2D,
  input: PosterInput,
  width: number,
  height: number
): void {
  const isMobile = window.innerWidth <= 480;

  const baseSize = Math.min(width, height) * 0.08;
  const titleSize = Math.max(36, Math.min(120, baseSize));
  const statsSize = isMobile ? titleSize * 0.4 : titleSize * 0.28;
  const labelSize = titleSize * 0.15;

  const baseSideMargin = Math.min(width, height) * 0.08;
  const baseTopMargin = Math.min(width, height) * 0.15;
  const sideMargin = Math.max(24, Math.min(120, baseSideMargin));
  const topMargin = Math.max(50, Math.min(200, baseTopMargin));

  const layout: PosterLayout = {
    margin: { side: sideMargin, top: topMargin },
    title: {
      fontSize: titleSize,
      color: input.isDark ? '#ffffff' : '#000000',
      lineHeight: Math.round(titleSize),
      maxWidth: isMobile ? width * 0.8 : width * 0.7,
    },
    stats: {
      font: `500 ${Math.round(statsSize)}px system-ui`,
      fontSize: Math.round(statsSize),
      color: input.isDark ? '#cccccc' : '#333333',
      spacing: isMobile ? 32 : 48,
    },
    bar: {
      height: isMobile ? 24 : 36,
      spacing: isMobile ? 48 : 60,
      labelFont: `600 ${Math.round(labelSize)}px system-ui`,
      bottomMargin: isMobile ? 72 : 120,
      lineHeight: Math.round(labelSize * 1.5),
    },
  };

  const barY = height - layout.bar.bottomMargin - 10;
  const titleEndY = drawTitle(ctx, input, layout);
  const statsY = isMobile ? titleEndY + 20 : barY - layout.stats.spacing - 64;

  drawStats(ctx, input, layout, statsY);
  drawCharacterBar(ctx, input.text, layout, width, height, input.isDark);
}

function drawTitle(ctx: CanvasRenderingContext2D, input: PosterInput, layout: PosterLayout): number {
  const fontSize = Math.round(layout.title.fontSize);
  ctx.font = `500 ${fontSize}px ${input.font.family}`;
  ctx.fillStyle = layout.title.color;
  ctx.textAlign = 'left';

  const words = input.text.split(' ');
  const lines = getTextLines(words, ctx, layout.title.maxWidth);

  let currentY = layout.margin.top;
  lines.forEach((line) => {
    ctx.fillText(line, layout.margin.side, currentY);
    currentY += layout.title.lineHeight;
  });
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

function drawStats(
  ctx: CanvasRenderingContext2D,
  input: PosterInput,
  layout: PosterLayout,
  yPosition: number
): void {
  const letterCount: Record<string, number> = {};
  input.text.toLowerCase().split('').forEach((char) => {
    if (input.hasKey(char)) letterCount[char] = (letterCount[char] || 0) + 1;
  });

  const totalChars = Object.values(letterCount).reduce((sum, count) => sum + count, 0);
  const uniqueChars = Object.keys(letterCount).length;

  ctx.font = layout.stats.font;
  ctx.fillStyle = layout.stats.color;
  ctx.textAlign = 'left';
  ctx.fillText(
    `${totalChars} characters · ${uniqueChars} unique keys`,
    layout.margin.side,
    yPosition
  );

  ctx.font = `700 ${Math.round(layout.stats.fontSize)}px system-ui`;
  const lineHeight = Math.round(layout.stats.fontSize * 1.2);
  ctx.fillText(`In use: ${input.font.name}`, layout.margin.side, yPosition + lineHeight);
}

function drawCharacterBar(
  ctx: CanvasRenderingContext2D,
  text: string,
  layout: PosterLayout,
  width: number,
  height: number,
  isDark: boolean
): void {
  const barY = height - layout.bar.bottomMargin;
  const barWidth = width - layout.margin.side * 2;
  const barHeight = layout.bar.height || 30;

  const letterCount: Record<string, number> = {};
  text.toLowerCase().split('').forEach((char) => {
    if (/[a-z0-9]/.test(char)) letterCount[char] = (letterCount[char] || 0) + 1;
  });

  const totalChars = Object.values(letterCount).reduce((sum, count) => sum + count, 0);
  if (totalChars === 0) return;

  const maxChars = calculateMaxCharactersForWidth(width);
  const sortedChars = Object.entries(letterCount).sort(([, a], [, b]) => b - a);
  const topChars = sortedChars.slice(0, maxChars);
  const othersCount = sortedChars.slice(maxChars).reduce((sum, [, count]) => sum + count, 0);

  let currentX = layout.margin.side;
  topChars.forEach(([char, count], index) => {
    const segmentWidth = (count / totalChars) * barWidth;
    if (segmentWidth > 0) {
      drawCharacterSegment(
        ctx,
        char,
        count,
        currentX,
        barY,
        segmentWidth,
        barHeight,
        isDark,
        index === 0,
        index === topChars.length - 1 && othersCount === 0
      );
      currentX += segmentWidth;
    }
  });

  if (othersCount > 0) {
    const segmentWidth = (othersCount / totalChars) * barWidth;
    if (segmentWidth > 0) drawOthersSegment(ctx, othersCount, currentX, barY, segmentWidth, barHeight, isDark);
  }
}

function drawCharacterSegment(
  ctx: CanvasRenderingContext2D,
  char: string,
  count: number,
  x: number,
  y: number,
  width: number,
  height: number,
  isDark: boolean,
  isFirst = false,
  isLast = false
): void {
  if (!char || char.trim() === '') return;
  const actualWidth = Math.max(width, 2);

  ctx.fillStyle = getCharacterFillColor(char, count);
  ctx.beginPath();
  roundRect(ctx, x, y, actualWidth, height, 6, isFirst, isLast);
  ctx.fill();

  const textColor = isDark ? '#ffffff' : '#000000';
  drawSegmentLabel(ctx, char, count, x, y, actualWidth, height, textColor);
}

function drawOthersSegment(
  ctx: CanvasRenderingContext2D,
  count: number,
  x: number,
  y: number,
  width: number,
  height: number,
  isDark: boolean
): void {
  ctx.save();
  const actualWidth = Math.max(width, 2);
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  roundRect(ctx, x, y, actualWidth, height, 6, false, true);
  ctx.fill();
  drawSegmentLabel(ctx, 'others', count, x, y, actualWidth, height, isDark ? '#ffffff' : '#000000');
  ctx.restore();
}

function drawSegmentLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  count: number,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): void {
  ctx.save();

  let fontSize = Math.min(20, height * 0.7);
  let textWidth: number;
  const displayText = count > 1 ? `${text} (${count})` : text;

  do {
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    textWidth = ctx.measureText(displayText).width;
    if (textWidth <= width - 10) break;
    fontSize -= 0.5;
  } while (fontSize > 12);

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayText, x + width / 2, y + height / 2);

  ctx.restore();
}
