/**
 * font-library — the typeface picker: a row of pinned-font chips with prev/next
 * cycling, and a slide-in drawer that browses the full Google Fonts catalog with
 * search, category/sort filters, per-weight previews, and an A–Z quick-jump rail.
 *
 * Applying a font goes through engine.setKeyCapFont() (which updates the 3D keycaps
 * AND engine.activeFont, so the poster title stays in sync) and also sets the HTML
 * text-display fontFamily. Pinned fonts persist in localStorage['favoriteFonts'].
 *
 * The drawer degrades gracefully when no Google Fonts API key is configured
 * (config.typography.googleFontsApiKey, defaulted from VITE_GOOGLE_FONTS_API_KEY):
 * the pinned fonts still work, the catalog just shows a notice.
 */
import type { OpenKeysModule } from '../../core/types';
import { buildGoogleFontCss, getCategoryFallback, fetchGoogleFontsCatalog, type GoogleFont } from './google-fonts';
import { createAzScrollGuide } from './az-scroll-guide';
import { showToast } from '../../shared/toast';
import './style.css';

interface FavoriteFont {
  id: string;
  name: string;
  family: string;
  origin: 'system' | 'google';
  cssUrl?: string;
}

const DEFAULT_PREVIEW_TEXT = 'Bend the grid. Break the rules.';
const MAX_FAVORITES = 5;

export const fontLibrary: OpenKeysModule = ({ engine, host, signal }) => {
  const q = <T extends HTMLElement = HTMLElement>(id: string) => host.querySelector<T>(`#${id}`);

  const fontControls = q('fontControls');
  if (!engine.config.features.fontDrawer) {
    fontControls?.classList.add('hidden');
    return () => {};
  }

  // --- Element references ---
  const fontName = q('fontName');
  const fontPrev = q('fontPrev');
  const fontNext = q('fontNext');
  const fontLibraryTrigger = q('fontLibraryTrigger');
  const textDisplay = q('textDisplay');
  const mobileTextDisplay = q('mobileTextDisplay');
  const fontDrawer = q('fontDrawer');
  const fontDrawerBackdrop = q('fontDrawerBackdrop');
  const fontDrawerClose = q('fontDrawerClose');
  const fontSearchInput = q<HTMLInputElement>('fontSearchInput');
  const fontSearchClear = q('fontSearchClear');
  const fontCategoryFilter = q<HTMLSelectElement>('fontCategoryFilter');
  const fontSortFilter = q<HTMLSelectElement>('fontSortFilter');
  const previewTextInput = q<HTMLInputElement>('previewTextInput');
  const showAllWeightsToggle = q<HTMLInputElement>('showAllWeightsToggle');
  const weightLayoutToggle = q<HTMLInputElement>('weightLayoutToggle');
  const weightLayoutLabel = q('weightLayoutLabel');
  const weightFilterSection = q('weightFilterSection');
  const weightFilterSelect = q<HTMLSelectElement>('weightFilterSelect');
  const variantFilterSection = q('variantFilterSection');
  const showItalicToggle = q<HTMLInputElement>('showItalicToggle');
  const showCondensedToggle = q<HTMLInputElement>('showCondensedToggle');
  const showExtendedToggle = q<HTMLInputElement>('showExtendedToggle');
  const fontLibraryList = q('fontLibraryList');
  const fontDrawerNotice = q('fontDrawerNotice');
  const favoriteFontsList = q('favoriteFontsList');
  const favoriteCount = q('favoriteCount');
  const azScrollGuideEl = q('azScrollGuide');

  const azGuide = createAzScrollGuide(azScrollGuideEl, fontLibraryList, signal);

  // --- State ---
  let favoriteFonts: FavoriteFont[] = [];
  let googleFontsCatalog: GoogleFont[] = [];
  let filteredFonts: GoogleFont[] = [];
  let currentFontIndex = 0;
  let currentCategory = 'all';
  let currentSort = 'popularity';
  let currentPreviewText = DEFAULT_PREVIEW_TEXT;
  let showAllWeights = false;
  let verticalLayout = false;
  let focusedWeight = '';
  let showItalic = false;
  let showCondensed = false;
  let showExtended = false;
  let fontSearchTimeout: number | undefined;
  let weightScrollObserver: IntersectionObserver | null = null;
  let catalogRequested = false;
  const loadedFontFamilies = new Set<string>();

  // --- Applying a font ---
  const updateFont = () => {
    if (!favoriteFonts.length) return;
    const font = favoriteFonts[currentFontIndex];
    if (fontName) fontName.textContent = font.name;
    [textDisplay, mobileTextDisplay].forEach((el) => {
      if (!el) return;
      el.style.fontFamily = font.family;
      el.style.fontWeight = '500';
      el.style.letterSpacing = 'normal';
    });
    engine.setKeyCapFont(font.family, font.name);
  };

  const shiftFont = (direction: number) => {
    if (!favoriteFonts.length) return;
    currentFontIndex = (currentFontIndex + direction + favoriteFonts.length) % favoriteFonts.length;
    updateFont();
    renderFavoriteChips();
  };

  // --- Favorites (persisted) ---
  const getStoredFavoriteFonts = (): FavoriteFont[] => {
    try {
      const raw = localStorage.getItem('favoriteFonts');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((f: any) => f?.name && f?.family && f?.id);
      }
    } catch (error) {
      console.warn('Failed to parse stored fonts', error);
    }
    return [];
  };

  const getDefaultFavoriteFonts = (): FavoriteFont[] => [
    { id: 'system', name: 'System', family: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', origin: 'system' },
    { id: 'inter', name: 'Inter', family: '"Inter", "Inter var", system-ui, sans-serif', origin: 'google', cssUrl: buildGoogleFontCss('Inter') },
    { id: 'space-grotesk', name: 'Space Grotesk', family: '"Space Grotesk", "Inter", system-ui, sans-serif', origin: 'google', cssUrl: buildGoogleFontCss('Space Grotesk') },
    { id: 'playfair-display', name: 'Playfair Display', family: '"Playfair Display", "Times New Roman", serif', origin: 'google', cssUrl: buildGoogleFontCss('Playfair Display') },
    { id: 'roboto-condensed', name: 'Roboto Condensed', family: '"Roboto Condensed", "Arial Narrow", sans-serif', origin: 'google', cssUrl: buildGoogleFontCss('Roboto Condensed') },
  ];

  const persistFavoriteFonts = () => localStorage.setItem('favoriteFonts', JSON.stringify(favoriteFonts));

  const ensureFontStyles = (font: FavoriteFont): Promise<void> => {
    if (font.origin === 'system') return Promise.resolve();
    const cacheKey = font.id || font.name.toLowerCase();
    if (loadedFontFamilies.has(cacheKey)) return Promise.resolve();

    const cssUrl = font.cssUrl || buildGoogleFontCss(font.name);
    font.cssUrl = cssUrl;

    return new Promise((resolve) => {
      const existing = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).some(
        (link) => link.getAttribute('href') === cssUrl
      );
      if (existing) {
        loadedFontFamilies.add(cacheKey);
        resolve();
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      link.onload = () => {
        loadedFontFamilies.add(cacheKey);
        resolve();
      };
      link.onerror = () => {
        console.warn(`Failed to load font stylesheet: ${cssUrl}`);
        resolve();
      };
      document.head.appendChild(link);
    });
  };

  const renderFavoriteChips = () => {
    if (!favoriteFontsList) return;
    favoriteFontsList.innerHTML = '';
    favoriteFonts.forEach((font, index) => {
      const chip = document.createElement('div');
      chip.className = 'favorite-font-chip';
      if (index === currentFontIndex) chip.classList.add('active');
      chip.dataset.fontId = font.id;

      const name = document.createElement('span');
      name.textContent = font.name;
      chip.appendChild(name);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', `Remove ${font.name} from favorites`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        removeFavoriteFont(font.id);
      });

      chip.addEventListener('click', () => {
        currentFontIndex = index;
        updateFont();
        renderFavoriteChips();
      });

      chip.appendChild(removeBtn);
      favoriteFontsList.appendChild(chip);
    });
    if (favoriteCount) favoriteCount.textContent = `${favoriteFonts.length} / ${MAX_FAVORITES}`;
  };

  const removeFavoriteFont = (fontId: string) => {
    if (favoriteFonts.length <= 1) {
      showFontDrawerNotice('Keep at least one font in your palette.');
      return;
    }
    const index = favoriteFonts.findIndex((f) => f.id === fontId);
    if (index === -1) return;
    favoriteFonts.splice(index, 1);
    if (currentFontIndex >= favoriteFonts.length) currentFontIndex = favoriteFonts.length - 1;
    persistFavoriteFonts();
    renderFavoriteChips();
    renderFontResults(filteredFonts);
    updateFont();
  };

  const handleFontSelection = async (font: GoogleFont) => {
    if (favoriteFonts.length >= MAX_FAVORITES) {
      showFontDrawerNotice(`Limit reached. Remove a font to add another (max ${MAX_FAVORITES}).`);
      return;
    }
    const favorite: FavoriteFont = {
      id: font.family.toLowerCase(),
      name: font.family,
      family: `"${font.family}", ${getCategoryFallback(font.category)}`,
      origin: 'google',
      cssUrl: buildGoogleFontCss(font.family),
    };
    favoriteFonts.push(favorite);
    currentFontIndex = favoriteFonts.length - 1;
    persistFavoriteFonts();
    await ensureFontStyles(favorite);
    renderFavoriteChips();
    renderFontResults(filteredFonts);
    updateFont();
    clearFontDrawerNotice();
  };

  const quickApplyFont = (font: GoogleFont) => {
    const family = `"${font.family}", ${getCategoryFallback(font.category)}`;
    [textDisplay, mobileTextDisplay].forEach((el) => {
      if (el) el.style.fontFamily = family;
    });
    if (fontName) fontName.textContent = `${font.family} (Preview)`;
    void ensureFontStyles({ id: font.family.toLowerCase(), name: font.family, family, origin: 'google' });
    engine.setKeyCapFont(family, font.family);
    showToast(`Previewing ${font.family}. Pin it to save.`, false);
  };

  // --- Drawer open/close ---
  const openFontDrawer = () => {
    if (!fontDrawer) return;
    fontDrawer.classList.add('show');
    document.body.classList.add('font-drawer-open');
    fontLibraryTrigger?.setAttribute('aria-expanded', 'true');
    fontDrawer.setAttribute('aria-hidden', 'false');
    loadGoogleFontsCatalog();
    setTimeout(() => fontSearchInput?.focus(), 150);
  };

  const closeFontDrawer = () => {
    if (!fontDrawer) return;
    fontDrawer.classList.remove('show');
    document.body.classList.remove('font-drawer-open');
    fontLibraryTrigger?.setAttribute('aria-expanded', 'false');
    fontDrawer.setAttribute('aria-hidden', 'true');
  };

  // --- Catalog + filtering ---
  const loadGoogleFontsCatalog = async (force = false) => {
    if (googleFontsCatalog.length && !force) {
      applyFiltersAndSort();
      return;
    }
    if (catalogRequested && !force) return;
    catalogRequested = true;

    const apiKey = engine.config.typography.googleFontsApiKey;
    if (!apiKey) {
      renderFontResults([]);
      showFontDrawerNotice('Add VITE_GOOGLE_FONTS_API_KEY to your .env file to browse 1500+ Google Fonts.');
      return;
    }

    if (fontLibraryList) {
      fontLibraryList.innerHTML = `
        <div class="font-drawer-loading">
          <div class="loading-spinner"></div>
          <p>Loading Google Fonts...</p>
        </div>`;
    }
    clearFontDrawerNotice();

    try {
      googleFontsCatalog = await fetchGoogleFontsCatalog(apiKey);
      applyFiltersAndSort();
    } catch (error) {
      console.error('Google Fonts API error:', error);
      catalogRequested = false; // allow a retry on the next open
      renderFontResults([]);
      showFontDrawerNotice('Unable to load Google Fonts. Check your API key or try again later.');
    }
  };

  const handleFontSearchInput = (value: string) => {
    if (fontSearchTimeout) window.clearTimeout(fontSearchTimeout);
    fontSearchTimeout = window.setTimeout(() => applyFiltersAndSort(value), 100);
  };

  const sortFonts = (fonts: GoogleFont[], sortType: string): GoogleFont[] => {
    const alpha = [...fonts].sort((a, b) => a.family.localeCompare(b.family));
    switch (sortType) {
      case 'trending':
      case 'date':
        return [...fonts].reverse();
      case 'alphabetical':
      case 'popularity':
      default:
        return alpha;
    }
  };

  const applyFiltersAndSort = (searchQuery?: string) => {
    if (!googleFontsCatalog.length) {
      filteredFonts = [];
      renderFontResults([]);
      return;
    }
    const query = searchQuery ?? fontSearchInput?.value ?? '';
    let results = [...googleFontsCatalog];
    if (query.trim()) {
      const trimmed = query.trim().toLowerCase();
      results = results.filter(
        (font) => font.family.toLowerCase().includes(trimmed) || font.category.toLowerCase().includes(trimmed)
      );
    }
    if (currentCategory !== 'all') {
      results = results.filter((font) => font.category.toLowerCase() === currentCategory.toLowerCase());
    }
    filteredFonts = sortFonts(results, currentSort);
    renderFontResults(filteredFonts);
  };

  const updateFontPreviews = () => {
    fontLibraryList?.querySelectorAll('.font-card-preview, .font-weight-preview').forEach((el) => {
      if (el.textContent !== currentPreviewText) el.textContent = currentPreviewText;
    });
  };

  // --- Rendering ---
  const renderFontResults = (fonts: GoogleFont[]) => {
    if (!fontLibraryList) return;
    fontLibraryList.innerHTML = '';

    if (!fonts.length) {
      const message = document.createElement('div');
      message.className = 'font-drawer-empty';
      message.textContent = googleFontsCatalog.length
        ? 'No fonts found. Try adjusting your filters or search.'
        : 'Loading fonts...';
      fontLibraryList.appendChild(message);
      azScrollGuideEl?.classList.add('hidden');
      return;
    }

    azScrollGuideEl?.classList.remove('hidden');

    const fontsByLetter: Record<string, GoogleFont[]> = {};
    const availableLetters = new Set<string>();
    fonts.forEach((font) => {
      const firstLetter = font.family[0].toUpperCase();
      (fontsByLetter[firstLetter] ||= []).push(font);
      availableLetters.add(firstLetter);
    });
    azGuide.setAvailableLetters(availableLetters);

    const fragment = document.createDocumentFragment();
    Object.keys(fontsByLetter)
      .sort()
      .forEach((letter) => {
        const section = document.createElement('div');
        section.className = 'font-letter-section';
        section.setAttribute('data-letter', letter);
        const heading = document.createElement('h3');
        heading.textContent = letter;
        section.appendChild(heading);
        fragment.appendChild(section);
        fontsByLetter[letter].forEach((font) => fragment.appendChild(createFontCard(font)));
      });
    fontLibraryList.appendChild(fragment);
  };

  const createFontCard = (font: GoogleFont): HTMLElement => {
    const isFavorite = favoriteFonts.some((f) => f.id === font.family.toLowerCase());

    const card = document.createElement('div');
    card.className = 'font-card';
    if (isFavorite) card.classList.add('pinned');

    const header = document.createElement('div');
    header.className = 'font-card-header';
    const info = document.createElement('div');
    info.className = 'font-card-info';
    const title = document.createElement('div');
    title.className = 'font-card-title';
    title.textContent = font.family;
    const meta = document.createElement('div');
    meta.className = 'font-card-meta';
    const category = document.createElement('span');
    category.className = 'font-card-category';
    category.textContent = font.category;
    const variants = document.createElement('span');
    variants.className = 'font-card-variants';
    variants.textContent = `${font.variants.length} style${font.variants.length !== 1 ? 's' : ''}`;
    meta.appendChild(category);
    meta.appendChild(variants);

    const hasItalic = font.variants.some((v) => v.includes('italic'));
    const hasCondensed = font.family.toLowerCase().includes('condensed');
    const hasExtended = font.family.toLowerCase().includes('extended');
    const isVariable = font.variants.some((v) => v.includes('variable') || v.includes('wght'));

    if (isVariable) {
      const badge = document.createElement('span');
      badge.className = 'font-card-badge variable';
      badge.textContent = 'Variable';
      badge.title = 'Variable font with adjustable weight axis';
      meta.appendChild(badge);
    }
    if (hasItalic && showItalic) {
      const badge = document.createElement('span');
      badge.className = 'font-card-badge italic';
      badge.textContent = 'Italic';
      meta.appendChild(badge);
    }
    if (hasCondensed && showCondensed) {
      const badge = document.createElement('span');
      badge.className = 'font-card-badge condensed';
      badge.textContent = 'Condensed';
      meta.appendChild(badge);
    }
    if (hasExtended && showExtended) {
      const badge = document.createElement('span');
      badge.className = 'font-card-badge extended';
      badge.textContent = 'Extended';
      meta.appendChild(badge);
    }

    info.appendChild(title);
    info.appendChild(meta);
    header.appendChild(info);

    const preview = document.createElement('div');
    preview.className = 'font-card-preview';
    preview.textContent = currentPreviewText;
    preview.style.fontFamily = `"${font.family}", ${getCategoryFallback(font.category)}`;

    const weightsPreview = document.createElement('div');
    weightsPreview.className = 'font-card-preview-weights';
    if (verticalLayout) weightsPreview.classList.add('vertical');
    if (showAllWeights) {
      card.classList.add('expanded');
      renderWeightPreviews(weightsPreview, font);
    }

    const actions = document.createElement('div');
    actions.className = 'font-card-actions';

    const pinButton = document.createElement('button');
    pinButton.type = 'button';
    pinButton.textContent = isFavorite ? '✓ Pinned' : 'Pin Font';
    pinButton.disabled = isFavorite;
    if (isFavorite) pinButton.classList.add('secondary');
    pinButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isFavorite) return;
      if (favoriteFonts.length >= MAX_FAVORITES) {
        showFontDrawerNotice(`Maximum ${MAX_FAVORITES} fonts. Remove one to add another.`);
        return;
      }
      handleFontSelection(font);
    });

    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'secondary';
    applyButton.textContent = 'Quick Apply';
    applyButton.addEventListener('click', (e) => {
      e.stopPropagation();
      quickApplyFont(font);
    });

    actions.appendChild(pinButton);
    actions.appendChild(applyButton);

    card.appendChild(header);
    card.appendChild(preview);
    card.appendChild(weightsPreview);
    card.appendChild(actions);

    // Lazily load the font's CSS (all weights) so previews render in the real face.
    void ensureFontStyles({
      id: font.family.toLowerCase(),
      name: font.family,
      family: `"${font.family}", ${getCategoryFallback(font.category)}`,
      origin: 'google',
      cssUrl: buildGoogleFontCss(font.family, font.variants),
    });

    return card;
  };

  const WEIGHT_LABELS: Record<string, string> = {
    '100': 'Thin', '200': 'Extra Light', '300': 'Light', '400': 'Regular', '500': 'Medium',
    '600': 'Semi Bold', '700': 'Bold', '800': 'Extra Bold', '900': 'Black',
  };

  const renderWeightPreviews = (container: HTMLElement, font: GoogleFont) => {
    const weights = font.variants
      .filter((v) => /^\d+$/.test(v) || v === 'regular' || v === 'italic')
      .map((v) => (v === 'regular' ? '400' : v === 'italic' ? '400italic' : v))
      .filter((v) => !v.includes('italic'))
      .sort((a, b) => parseInt(a) - parseInt(b));
    const uniqueWeights = [...new Set(weights)];

    const addRow = (weight: string | null) => {
      const row = document.createElement('div');
      row.className = 'font-weight-row';
      if (weight) {
        row.setAttribute('data-weight', weight);
        if (focusedWeight && weight === focusedWeight) row.classList.add('focused');
      }
      const label = document.createElement('span');
      label.className = 'font-weight-label';
      label.textContent = weight ? WEIGHT_LABELS[weight] || weight : 'Regular';
      const preview = document.createElement('div');
      preview.className = 'font-weight-preview';
      preview.textContent = currentPreviewText;
      preview.style.fontFamily = `"${font.family}", ${getCategoryFallback(font.category)}`;
      preview.style.fontWeight = weight || '400';
      if (showItalic) preview.style.fontStyle = 'italic';
      row.appendChild(preview);
      row.appendChild(label);
      container.appendChild(row);
    };

    if (!uniqueWeights.length) addRow(null);
    else uniqueWeights.forEach((w) => addRow(w));
  };

  const applyWeightFocus = () => {
    fontLibraryList?.querySelectorAll('.font-weight-row.focused').forEach((el) => el.classList.remove('focused'));
    if (!focusedWeight) {
      weightScrollObserver?.disconnect();
      weightScrollObserver = null;
      return;
    }
    fontLibraryList?.querySelectorAll('.font-weight-row').forEach((row) => {
      if (row.getAttribute('data-weight') === focusedWeight) row.classList.add('focused');
    });
    setupWeightScrollObserver();
  };

  const setupWeightScrollObserver = () => {
    weightScrollObserver?.disconnect();
    weightScrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || !focusedWeight) return;
          const focused = (entry.target as HTMLElement).querySelector(
            `.font-weight-row[data-weight="${focusedWeight}"]`
          );
          if (focused) {
            setTimeout(() => focused.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 50);
          }
        });
      },
      { root: fontLibraryList, threshold: 0.1, rootMargin: '50px' }
    );
    fontLibraryList?.querySelectorAll('.font-card-preview-weights').forEach((c) => weightScrollObserver?.observe(c));
  };

  const showFontDrawerNotice = (message: string) => {
    if (!fontDrawerNotice) return;
    fontDrawerNotice.textContent = message;
    fontDrawerNotice.classList.remove('hidden');
  };
  const clearFontDrawerNotice = () => {
    if (fontDrawerNotice) {
      fontDrawerNotice.classList.add('hidden');
      fontDrawerNotice.textContent = '';
    }
  };

  // --- Wire controls ---
  fontPrev?.addEventListener('click', (e) => { e.stopPropagation(); shiftFont(-1); }, { signal });
  fontNext?.addEventListener('click', (e) => { e.stopPropagation(); shiftFont(1); }, { signal });
  fontLibraryTrigger?.addEventListener('click', (e) => { e.preventDefault(); openFontDrawer(); }, { signal });

  fontDrawerBackdrop?.addEventListener('click', closeFontDrawer, { signal });
  fontDrawerClose?.addEventListener('click', closeFontDrawer, { signal });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && fontDrawer?.classList.contains('show')) closeFontDrawer();
    },
    { signal }
  );

  fontSearchInput?.addEventListener('input', (e) => handleFontSearchInput((e.target as HTMLInputElement).value), { signal });
  fontSearchClear?.addEventListener(
    'click',
    () => {
      if (!fontSearchInput) return;
      fontSearchInput.value = '';
      handleFontSearchInput('');
      fontSearchInput.focus();
    },
    { signal }
  );

  fontCategoryFilter?.addEventListener('change', (e) => { currentCategory = (e.target as HTMLSelectElement).value; applyFiltersAndSort(); }, { signal });
  fontSortFilter?.addEventListener('change', (e) => { currentSort = (e.target as HTMLSelectElement).value; applyFiltersAndSort(); }, { signal });
  previewTextInput?.addEventListener(
    'input',
    (e) => { currentPreviewText = (e.target as HTMLInputElement).value || DEFAULT_PREVIEW_TEXT; updateFontPreviews(); },
    { signal }
  );

  showAllWeightsToggle?.addEventListener(
    'change',
    (e) => {
      showAllWeights = (e.target as HTMLInputElement).checked;
      const toggleHidden = (el: HTMLElement | null, hidden: boolean) => el?.classList.toggle('hidden', hidden);
      toggleHidden(weightLayoutLabel, !showAllWeights);
      toggleHidden(weightFilterSection, !showAllWeights);
      toggleHidden(variantFilterSection, !showAllWeights);
      renderFontResults(filteredFonts);
    },
    { signal }
  );
  weightLayoutToggle?.addEventListener(
    'change',
    (e) => {
      verticalLayout = (e.target as HTMLInputElement).checked;
      fontLibraryList?.querySelectorAll('.font-card-preview-weights').forEach((c) => c.classList.toggle('vertical', verticalLayout));
    },
    { signal }
  );
  weightFilterSelect?.addEventListener('change', (e) => { focusedWeight = (e.target as HTMLSelectElement).value; applyWeightFocus(); }, { signal });
  showItalicToggle?.addEventListener('change', (e) => { showItalic = (e.target as HTMLInputElement).checked; renderFontResults(filteredFonts); }, { signal });
  showCondensedToggle?.addEventListener('change', (e) => { showCondensed = (e.target as HTMLInputElement).checked; renderFontResults(filteredFonts); }, { signal });
  showExtendedToggle?.addEventListener('change', (e) => { showExtended = (e.target as HTMLInputElement).checked; renderFontResults(filteredFonts); }, { signal });

  // --- Boot: load favorites + apply the active font ---
  (async () => {
    const stored = getStoredFavoriteFonts();
    favoriteFonts = stored.length ? stored.slice(0, MAX_FAVORITES) : getDefaultFavoriteFonts();
    for (const font of favoriteFonts) await ensureFontStyles(font);
    if (currentFontIndex >= favoriteFonts.length) currentFontIndex = 0;
    renderFavoriteChips();
    updateFont();
  })();

  return () => {
    if (fontSearchTimeout) window.clearTimeout(fontSearchTimeout);
    weightScrollObserver?.disconnect();
    weightScrollObserver = null;
    document.body.classList.remove('font-drawer-open');
  };
};
