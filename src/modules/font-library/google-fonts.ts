/** Google Fonts catalog access + CSS-URL helpers (module-private to font-library). */

export interface GoogleFont {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
}

/** Build a Google Fonts CSS2 URL for a family, optionally restricted to its numeric weights. */
export function buildGoogleFontCss(name: string, weights?: string[]): string {
  const family = name.trim().replace(/\s+/g, '+');

  if (weights && weights.length > 0) {
    const numericWeights = weights
      .filter((w) => /^\d+$/.test(w) || w === 'regular')
      .map((w) => (w === 'regular' ? '400' : w))
      .sort((a, b) => parseInt(a) - parseInt(b))
      .join(';');
    if (numericWeights) {
      return `https://fonts.googleapis.com/css2?family=${family}:wght@${numericWeights}&display=swap`;
    }
  }

  return `https://fonts.googleapis.com/css2?family=${family}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
}

/** A sensible generic-family fallback for a given Google Fonts category. */
export function getCategoryFallback(category: string = ''): string {
  const normalized = category.toLowerCase();
  if (normalized.includes('serif')) return 'serif';
  if (normalized.includes('mono')) return 'monospace';
  if (normalized.includes('hand')) return '"Comic Neue", cursive';
  if (normalized.includes('display')) return '"Helvetica Neue", system-ui, sans-serif';
  return 'system-ui, -apple-system, sans-serif';
}

/** Fetch the full catalog (sorted by popularity). Throws on a non-OK response. */
export async function fetchGoogleFontsCatalog(apiKey: string): Promise<GoogleFont[]> {
  const response = await fetch(
    `https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${apiKey}`
  );
  if (!response.ok) throw new Error('Failed to load fonts');
  const data = await response.json();
  return (data.items || []) as GoogleFont[];
}
