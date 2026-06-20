/** Shared helpers used by both the character-bar module and the poster renderer. */

/** Deterministic per-character fill color (golden-angle hue), opacity scaled by count. */
export function getCharacterFillColor(char: string, count: number): string {
  const charCode = char.charCodeAt(0);
  const hue = (charCode * 137.5) % 360; // golden angle for even distribution
  const saturation = 70 + (charCode % 20); // 70–90%
  const lightness = 50 + (charCode % 10) - 5; // 45–55%
  const opacity = Math.min(0.2 + count * 0.02, 0.8);
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`;
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
