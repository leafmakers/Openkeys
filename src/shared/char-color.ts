/** Shared helpers used by both the character-bar module and the poster renderer. */

/**
 * A curated 12-color palette for the frequency bar. Vivid mid-tones (≈45–72% sat,
 * ≈47–65% light) — the same family the golden-angle generator used, but hand-picked
 * to be clearly differentiated (no near-duplicate hues) and ordered so that
 * CONSECUTIVE entries are far apart on the wheel. Colors are assigned by segment
 * RANK, not by character, so the visible segments always step through this spread
 * and never land on two near-identical colors.
 */
export const BAR_PALETTE = [
  'hsl(6, 70%, 61%)', // coral red
  'hsl(214, 66%, 60%)', // blue
  'hsl(43, 68%, 55%)', // amber
  'hsl(276, 52%, 63%)', // violet
  'hsl(172, 52%, 47%)', // teal
  'hsl(336, 64%, 63%)', // rose
  'hsl(96, 47%, 51%)', // green
  'hsl(248, 56%, 65%)', // indigo
  'hsl(26, 72%, 57%)', // orange
  'hsl(190, 60%, 53%)', // cyan
  'hsl(305, 50%, 61%)', // magenta
  'hsl(150, 45%, 49%)', // emerald
];

/** Fill color for the segment at `index` (its frequency rank), cycling the palette. */
export function getCharacterFillColor(index: number): string {
  return BAR_PALETTE[index % BAR_PALETTE.length];
}

/** Neutral fill for the collapsed "others" segment, per theme. */
export function getOthersFillColor(isDark: boolean): string {
  return isDark ? 'hsl(210, 6%, 44%)' : 'hsl(210, 9%, 76%)';
}

/** How many distinct character segments fit before collapsing the rest into "others". */
export function calculateMaxCharactersForWidth(width: number): number {
  if (width <= 320) return 2; // very small phones
  if (width <= 480) return 3; // small phones
  if (width <= 640) return 4; // large phones / small tablets
  if (width <= 900) return 5; // tablets / small desktops
  if (width <= 1200) return 6; // medium desktops
  return 7; // large desktops
}
