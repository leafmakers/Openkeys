import type { OpenKeysConfig } from '../core/config';
import { showToast } from '../shared/toast';

interface UIElements {
  // Core UI Elements
  heightUpBtn: HTMLElement | null;
  heightDownBtn: HTMLElement | null;
  textDisplay: HTMLElement | null;
  mobileTextDisplay: HTMLElement | null;
  typeButton: HTMLElement | null;
  clearButton: HTMLElement | null;
  characterCount: HTMLElement | null;
  characterBarSegments: HTMLElement | null;
  warning: HTMLElement | null;
  typingSpeed?: HTMLElement | null;
  downloadPoster?: HTMLElement | null;
  remixWithAI?: HTMLElement | null;
  fontSize?: HTMLElement | null;
  typingSpeedDisplay?: HTMLElement | null;
  fontName?: HTMLElement | null;
  fontPrev?: HTMLElement | null;
  fontNext?: HTMLElement | null;
  fontControls?: HTMLElement | null;
  fontLibraryTrigger?: HTMLElement | null;
  fontDrawer?: HTMLElement | null;
  fontDrawerPanel?: HTMLElement | null;
  fontDrawerBackdrop?: HTMLElement | null;
  fontDrawerClose?: HTMLElement | null;
  fontSearchInput?: HTMLInputElement | null;
  fontSearchClear?: HTMLElement | null;
  fontLibraryList?: HTMLElement | null;
  fontDrawerNotice?: HTMLElement | null;
  favoriteFontsList?: HTMLElement | null;
  favoriteCount?: HTMLElement | null;
  fontCategoryFilter?: HTMLSelectElement | null;
  fontSortFilter?: HTMLSelectElement | null;
  previewTextInput?: HTMLInputElement | null;
  showAllWeightsToggle?: HTMLInputElement | null;
  weightLayoutToggle?: HTMLInputElement | null;
  weightLayoutLabel?: HTMLElement | null;
  weightFilterSection?: HTMLElement | null;
  weightFilterSelect?: HTMLSelectElement | null;
  variantFilterSection?: HTMLElement | null;
  showItalicToggle?: HTMLInputElement | null;
  showCondensedToggle?: HTMLInputElement | null;
  showExtendedToggle?: HTMLInputElement | null;
  azScrollGuide?: HTMLElement | null;
  
  // Preview-related elements (optional)
  previewModal?: HTMLElement | null;
  previewText?: HTMLElement | null;
  previewClose?: HTMLElement | null;
  previewDownload?: HTMLElement | null;
  previewRemix?: HTMLElement | null;
  previewFontSize?: HTMLElement | null;
  previewImage?: HTMLImageElement | null;
  
  // Other optional elements
  keyboardHeightControl?: HTMLInputElement | null;
  keyboardHeightText?: HTMLElement | null;
  fontSizeControl?: HTMLInputElement | null;
  fontSizeText?: HTMLElement | null;
  textInput?: HTMLTextAreaElement | null;
  closePreview?: HTMLElement | null;
  printFromPreview?: HTMLElement | null;
  previewAndPrint?: HTMLElement | null;
  shadowAngle?: HTMLInputElement | null;
}

interface GoogleFont {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
}

interface FavoriteFont {
  id: string;
  name: string;
  family: string;
  origin: 'system' | 'google';
  cssUrl?: string;
}

export class UI {
  private config: OpenKeysConfig;
  private engine: any;
  private keyboard: Record<string, any>;
  private elements: UIElements = {
    // Initialize only required properties
    heightUpBtn: null,
    heightDownBtn: null,
    textDisplay: null,
    mobileTextDisplay: null,
    typeButton: null,
    clearButton: null,
    characterCount: null,
    characterBarSegments: null,
    warning: null
  };
  private favoriteFonts: FavoriteFont[];
  private readonly maxFavoriteFonts: number = 5;
  private googleFontsCatalog: GoogleFont[];
  private fontDrawerInitialized: boolean;
  private fontSearchTimeout?: number;
  private loadedFontFamilies: Set<string>;
  private currentFontIndex: number;
  private currentCategory: string = 'all';
  private currentSort: string = 'popularity';
  private currentPreviewText: string = 'Bend the grid. Break the rules.';
  private showAllWeights: boolean = false;
  private verticalLayout: boolean = false;
  private focusedWeight: string = '';
  private showItalic: boolean = false;
  private showCondensed: boolean = false;
  private showExtended: boolean = false;
  private filteredFonts: GoogleFont[] = [];
  private weightScrollObserver: IntersectionObserver | null = null;

  constructor(engine: any, config: OpenKeysConfig) {
    this.engine = engine;
    this.keyboard = engine.keyboard;
    this.config = config;

    // Initialize elements with all properties
    this.elements = {
      // Required properties
      heightUpBtn: document.getElementById('heightUpBtn'),
      heightDownBtn: document.getElementById('heightDownBtn'),
      textDisplay: document.getElementById('textDisplay'),
      mobileTextDisplay: document.getElementById('mobileTextDisplay'),
      typeButton: document.getElementById('typeButton'),
      clearButton: document.getElementById('clearButton'),
      characterCount: document.getElementById('characterCount'),
      characterBarSegments: document.getElementById('characterBarSegments'),
      warning: document.getElementById('warning'),
      
      // Optional properties
      typingSpeed: document.getElementById('typingSpeed'),
      downloadPoster: document.getElementById('downloadPoster'),
      remixWithAI: document.getElementById('remixWithAI'),
      fontSize: document.getElementById('fontSize'),
      typingSpeedDisplay: document.getElementById('typingSpeedDisplay'),
      fontName: document.getElementById('fontName'),
      fontPrev: document.getElementById('fontPrev'),
      fontNext: document.getElementById('fontNext'),
      
      // Preview-related elements
      previewModal: document.getElementById('previewModal') as HTMLElement | null,
      previewText: document.getElementById('previewText'),
      previewClose: document.getElementById('previewClose'),
      previewDownload: document.getElementById('previewDownload'),
      previewRemix: document.getElementById('previewRemix'),
      previewFontSize: document.getElementById('previewFontSize'),
      previewImage: document.getElementById('previewImage') as HTMLImageElement | null,
      
      // Other optional elements
      keyboardHeightControl: document.getElementById('keyboardHeight') as HTMLInputElement | null,
      keyboardHeightText: document.getElementById('keyboardHeightText'),
      fontSizeControl: document.getElementById('fontSizeControl') as HTMLInputElement | null,
      fontSizeText: document.getElementById('fontSizeText'),
      textInput: document.getElementById('textInput') as HTMLTextAreaElement | null,
      closePreview: document.getElementById('closePreview'),
      printFromPreview: document.getElementById('printFromPreview'),
      previewAndPrint: document.getElementById('previewAndPrint'),
      shadowAngle: document.getElementById('shadowAngle') as HTMLInputElement | null
    };
    this.favoriteFonts = [];
    this.googleFontsCatalog = [];
    this.fontDrawerInitialized = false;
    this.loadedFontFamilies = new Set();
    this.currentFontIndex = 0;
    this.setupElements();
    this.setupEventListeners();
    this.initializeFontFavorites();
    // Theme, text display/counter/type-anywhere, poster, and settings are now owned by
    // their respective modules. What remains here is the font library (extracted next).
  }

  private setupElements() {
    this.elements = {
      heightUpBtn: document.getElementById('heightUp'),
      heightDownBtn: document.getElementById('heightDown'),
      textDisplay: document.getElementById('textDisplay'),
      mobileTextDisplay: document.getElementById('mobileTextDisplay'),
      typeButton: document.getElementById('type'),
      clearButton: document.getElementById('clearButton'),
      characterCount: document.getElementById('characterCount'),
      characterBarSegments: document.getElementById('characterBarSegments'),
      warning: document.getElementById('warning'),
      previewModal: document.getElementById('previewModal'),
      previewImage: document.getElementById('previewImage') as HTMLImageElement,
      closePreview: document.getElementById('closePreview'),
      printFromPreview: document.getElementById('printFromPreview'),
      previewAndPrint: document.getElementById('previewAndPrint'),
      shadowAngle: document.getElementById('shadowAngle') as HTMLInputElement,
      fontPrev: document.getElementById('fontPrev'),
      fontNext: document.getElementById('fontNext'),
      fontName: document.getElementById('fontName'),
      fontControls: document.getElementById('fontControls'),
      fontLibraryTrigger: document.getElementById('fontLibraryTrigger'),
      fontDrawer: document.getElementById('fontDrawer'),
      fontDrawerPanel: document.getElementById('fontDrawerPanel'),
      fontDrawerBackdrop: document.getElementById('fontDrawerBackdrop'),
      fontDrawerClose: document.getElementById('fontDrawerClose'),
      fontSearchInput: document.getElementById('fontSearchInput') as HTMLInputElement | null,
      fontSearchClear: document.getElementById('fontSearchClear'),
      fontLibraryList: document.getElementById('fontLibraryList'),
      fontDrawerNotice: document.getElementById('fontDrawerNotice'),
      favoriteFontsList: document.getElementById('favoriteFontsList'),
      favoriteCount: document.getElementById('favoriteCount'),
      fontCategoryFilter: document.getElementById('fontCategoryFilter') as HTMLSelectElement | null,
      fontSortFilter: document.getElementById('fontSortFilter') as HTMLSelectElement | null,
      previewTextInput: document.getElementById('previewTextInput') as HTMLInputElement | null,
      showAllWeightsToggle: document.getElementById('showAllWeightsToggle') as HTMLInputElement | null,
      weightLayoutToggle: document.getElementById('weightLayoutToggle') as HTMLInputElement | null,
      weightLayoutLabel: document.getElementById('weightLayoutLabel'),
      weightFilterSection: document.getElementById('weightFilterSection'),
      weightFilterSelect: document.getElementById('weightFilterSelect') as HTMLSelectElement | null,
      variantFilterSection: document.getElementById('variantFilterSection'),
      showItalicToggle: document.getElementById('showItalicToggle') as HTMLInputElement | null,
      showCondensedToggle: document.getElementById('showCondensedToggle') as HTMLInputElement | null,
      showExtendedToggle: document.getElementById('showExtendedToggle') as HTMLInputElement | null,
      azScrollGuide: document.getElementById('azScrollGuide'),
      typingSpeed: document.getElementById('typingSpeed')
    };

    this.setupAZScrollGuide();
  }

  private setupEventListeners() {
    this.setupButtonListeners();
    this.setupThemeToggle();
    this.setupFontControls();
  }

  private setupButtonListeners() {
    // Castle / Clear "mode" toggle (↑ ↓). Clear is also exposed via the text-input clear button.
    this.elements.heightUpBtn?.addEventListener('click', () => {
      this.elements.heightUpBtn?.classList.add('active');
      this.elements.heightDownBtn?.classList.remove('active');
      this.engine.setText(this.engine.currentText);
    });

    this.elements.heightDownBtn?.addEventListener('click', async () => {
      this.elements.heightDownBtn?.classList.add('active');
      this.elements.heightUpBtn?.classList.remove('active');
      await this.engine.clear();
      setTimeout(() => {
        this.elements.heightUpBtn?.classList.add('active');
        this.elements.heightDownBtn?.classList.remove('active');
      }, 500);
    });
    // The shadow-angle slider is now wired by the settings-panel module.
  }

  private setupFontControls() {
    this.elements.fontPrev?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.shiftFont(-1);
    });

    this.elements.fontNext?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.shiftFont(1);
    });

    this.elements.fontLibraryTrigger?.addEventListener('click', (event) => {
      event.preventDefault();
      this.openFontDrawer();
    });
  }

  private shiftFont(direction: number) {
    if (!this.favoriteFonts.length) return;
    this.currentFontIndex = (this.currentFontIndex + direction + this.favoriteFonts.length) % this.favoriteFonts.length;
    this.updateFont();
  }

  private updateFont() {
    if (!this.favoriteFonts.length) return;
    const currentFont = this.favoriteFonts[this.currentFontIndex];
    
    // Update font name display
    if (this.elements.fontName) {
      this.elements.fontName.textContent = currentFont.name;
    }

    // Apply font to text displays
    if (this.elements.textDisplay) {
      this.elements.textDisplay.style.fontFamily = currentFont.family;
      this.elements.textDisplay.style.fontWeight = '500';
      this.elements.textDisplay.style.letterSpacing = 'normal';
    }
    if (this.elements.mobileTextDisplay) {
      this.elements.mobileTextDisplay.style.fontFamily = currentFont.family;
      this.elements.mobileTextDisplay.style.fontWeight = '500';
      this.elements.mobileTextDisplay.style.letterSpacing = 'normal';
    }

    // Update 3D key cap text to match font style
    this.keyboard.updateKeyCapFont(currentFont.family, currentFont.name);
  }

  private async initializeFontFavorites() {
    const stored = this.getStoredFavoriteFonts();
    this.favoriteFonts = stored.length ? stored.slice(0, this.maxFavoriteFonts) : this.getDefaultFavoriteFonts();
    
    for (const font of this.favoriteFonts) {
      await this.ensureFontStyles(font);
    }

    if (this.currentFontIndex >= this.favoriteFonts.length) {
      this.currentFontIndex = 0;
    }

    this.renderFavoriteChips();
    this.updateFont();
  }

  private getStoredFavoriteFonts(): FavoriteFont[] {
    try {
      const raw = localStorage.getItem('favoriteFonts');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((font: any) => font?.name && font?.family && font?.id);
      }
    } catch (error) {
      console.warn('Failed to parse stored fonts', error);
    }
    return [];
  }

  private getDefaultFavoriteFonts(): FavoriteFont[] {
    return [
      { id: 'system', name: 'System', family: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', origin: 'system' },
      { id: 'inter', name: 'Inter', family: '"Inter", "Inter var", system-ui, sans-serif', origin: 'google', cssUrl: this.buildGoogleFontCss('Inter') },
      { id: 'space-grotesk', name: 'Space Grotesk', family: '"Space Grotesk", "Inter", system-ui, sans-serif', origin: 'google', cssUrl: this.buildGoogleFontCss('Space Grotesk') },
      { id: 'playfair-display', name: 'Playfair Display', family: '"Playfair Display", "Times New Roman", serif', origin: 'google', cssUrl: this.buildGoogleFontCss('Playfair Display') },
      { id: 'roboto-condensed', name: 'Roboto Condensed', family: '"Roboto Condensed", "Arial Narrow", sans-serif', origin: 'google', cssUrl: this.buildGoogleFontCss('Roboto Condensed') }
    ];
  }

  private persistFavoriteFonts() {
    localStorage.setItem('favoriteFonts', JSON.stringify(this.favoriteFonts));
  }

  private ensureFontStyles(font: FavoriteFont): Promise<void> {
    if (font.origin === 'system') {
      return Promise.resolve();
    }

    const cacheKey = font.id || font.name.toLowerCase();
    if (this.loadedFontFamilies.has(cacheKey)) {
      return Promise.resolve();
    }

    const cssUrl = font.cssUrl || this.buildGoogleFontCss(font.name);
    font.cssUrl = cssUrl;

    return new Promise((resolve) => {
      const existing = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
        .some(link => link.getAttribute('href') === cssUrl);
      if (existing) {
        this.loadedFontFamilies.add(cacheKey);
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      link.onload = () => {
        this.loadedFontFamilies.add(cacheKey);
        resolve();
      };
      link.onerror = () => {
        console.warn(`Failed to load font stylesheet: ${cssUrl}`);
        resolve();
      };
      document.head.appendChild(link);
    });
  }

  private buildGoogleFontCss(name: string, weights?: string[]): string {
    const family = name.trim().replace(/\s+/g, '+');
    
    // If weights are provided, use them; otherwise use common weights
    if (weights && weights.length > 0) {
      // Parse numeric weights only
      const numericWeights = weights
        .filter(w => /^\d+$/.test(w) || w === 'regular')
        .map(w => w === 'regular' ? '400' : w)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .join(';');
      
      if (numericWeights) {
        return `https://fonts.googleapis.com/css2?family=${family}:wght@${numericWeights}&display=swap`;
      }
    }
    
    // Default fallback weights
    return `https://fonts.googleapis.com/css2?family=${family}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
  }

  private renderFavoriteChips() {
    if (!this.elements.favoriteFontsList) return;
    this.elements.favoriteFontsList.innerHTML = '';

    this.favoriteFonts.forEach((font, index) => {
      const chip = document.createElement('div');
      chip.className = 'favorite-font-chip';
      if (index === this.currentFontIndex) chip.classList.add('active');
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
        this.removeFavoriteFont(font.id);
      });

      chip.addEventListener('click', () => {
        this.currentFontIndex = index;
        this.updateFont();
        this.renderFavoriteChips();
      });

      chip.appendChild(removeBtn);
      this.elements.favoriteFontsList?.appendChild(chip);
    });

    if (this.elements.favoriteCount) {
      this.elements.favoriteCount.textContent = `${this.favoriteFonts.length} / ${this.maxFavoriteFonts}`;
    }
  }

  private openFontDrawer() {
    if (!this.elements.fontDrawer) return;
    this.elements.fontDrawer.classList.add('show');
    document.body.classList.add('font-drawer-open');
    this.elements.fontLibraryTrigger?.setAttribute('aria-expanded', 'true');
    this.elements.fontDrawer.setAttribute('aria-hidden', 'false');

    if (!this.fontDrawerInitialized) {
      this.initializeFontDrawerEvents();
      this.fontDrawerInitialized = true;
    }

    this.loadGoogleFontsCatalog();
    setTimeout(() => {
      this.elements.fontSearchInput?.focus();
    }, 150);
  }

  private closeFontDrawer() {
    if (!this.elements.fontDrawer) return;
    this.elements.fontDrawer.classList.remove('show');
    document.body.classList.remove('font-drawer-open');
    this.elements.fontLibraryTrigger?.setAttribute('aria-expanded', 'false');
    this.elements.fontDrawer.setAttribute('aria-hidden', 'true');
  }

  private initializeFontDrawerEvents() {
    this.elements.fontDrawerBackdrop?.addEventListener('click', () => this.closeFontDrawer());
    this.elements.fontDrawerClose?.addEventListener('click', () => this.closeFontDrawer());

    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.elements.fontDrawer?.classList.contains('show')) {
        this.closeFontDrawer();
      }
    });

    this.elements.fontSearchInput?.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      this.handleFontSearchInput(target.value);
    });

    this.elements.fontSearchClear?.addEventListener('click', () => {
      if (this.elements.fontSearchInput) {
        this.elements.fontSearchInput.value = '';
        this.handleFontSearchInput('');
        this.elements.fontSearchInput.focus();
      }
    });

    // Category filter
    this.elements.fontCategoryFilter?.addEventListener('change', (event) => {
      const target = event.target as HTMLSelectElement;
      this.currentCategory = target.value;
      this.applyFiltersAndSort();
    });

    // Sort filter
    this.elements.fontSortFilter?.addEventListener('change', (event) => {
      const target = event.target as HTMLSelectElement;
      this.currentSort = target.value;
      this.applyFiltersAndSort();
    });

    // Preview text
    this.elements.previewTextInput?.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      this.currentPreviewText = target.value || 'Bend the grid. Break the rules.';
      // Update all visible font cards with new preview text
      this.updateFontPreviews();
    });

    // Show all weights toggle
    this.elements.showAllWeightsToggle?.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      this.showAllWeights = target.checked;
      
      // Show/hide related controls
      if (this.showAllWeights) {
        this.elements.weightLayoutLabel?.classList.remove('hidden');
        this.elements.weightFilterSection?.classList.remove('hidden');
        this.elements.variantFilterSection?.classList.remove('hidden');
      } else {
        this.elements.weightLayoutLabel?.classList.add('hidden');
        this.elements.weightFilterSection?.classList.add('hidden');
        this.elements.variantFilterSection?.classList.add('hidden');
      }
      
      // Re-render all font cards with weight preview
      this.renderFontResults(this.filteredFonts);
    });

    // Weight layout toggle (horizontal vs vertical)
    this.elements.weightLayoutToggle?.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      this.verticalLayout = target.checked;
      
      // Update all weight preview containers
      const weightContainers = document.querySelectorAll('.font-card-preview-weights');
      weightContainers.forEach(container => {
        if (this.verticalLayout) {
          container.classList.add('vertical');
        } else {
          container.classList.remove('vertical');
        }
      });
    });

    // Weight filter - focus on specific weight
    this.elements.weightFilterSelect?.addEventListener('change', (event) => {
      const target = event.target as HTMLSelectElement;
      this.focusedWeight = target.value;
      this.applyWeightFocus();
    });

    // Variant toggles
    this.elements.showItalicToggle?.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      this.showItalic = target.checked;
      this.renderFontResults(this.filteredFonts);
    });

    this.elements.showCondensedToggle?.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      this.showCondensed = target.checked;
      this.renderFontResults(this.filteredFonts);
    });

    this.elements.showExtendedToggle?.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      this.showExtended = target.checked;
      this.renderFontResults(this.filteredFonts);
    });
  }

  private applyWeightFocus() {
    // Remove all existing focused classes
    document.querySelectorAll('.font-weight-row.focused').forEach(el => {
      el.classList.remove('focused');
    });

    if (!this.focusedWeight) {
      // Clean up observer if no weight is focused
      if (this.weightScrollObserver) {
        this.weightScrollObserver.disconnect();
        this.weightScrollObserver = null;
      }
      return;
    }

    // Add focused class to matching weights
    document.querySelectorAll('.font-weight-row').forEach(row => {
      const weightAttr = row.getAttribute('data-weight');
      if (weightAttr === this.focusedWeight) {
        row.classList.add('focused');
      }
    });

    // Set up Intersection Observer for auto-scroll on visibility
    this.setupWeightScrollObserver();
  }

  private setupWeightScrollObserver() {
    // Disconnect existing observer
    if (this.weightScrollObserver) {
      this.weightScrollObserver.disconnect();
    }

    // Create new observer that watches font card weight containers
    this.weightScrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && this.focusedWeight) {
          // Card is now visible, scroll to focused weight
          const container = entry.target as HTMLElement;
          const focusedWeight = container.querySelector(`.font-weight-row[data-weight="${this.focusedWeight}"]`);
          
          if (focusedWeight) {
            // Delay slightly to ensure layout is complete
            setTimeout(() => {
              focusedWeight.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest', 
                inline: 'center' 
              });
            }, 50);
          }
        }
      });
    }, {
      root: document.querySelector('.font-drawer-list'),
      threshold: 0.1, // Trigger when 10% visible
      rootMargin: '50px' // Start observing slightly before entering viewport
    });

    // Observe all weight preview containers
    document.querySelectorAll('.font-card-preview-weights').forEach(container => {
      this.weightScrollObserver?.observe(container);
    });
  }

  private setupAZScrollGuide() {
    if (!this.elements.azScrollGuide) {
      console.warn('A-Z scroll guide element not found');
      return;
    }

    const buttons = this.elements.azScrollGuide.querySelectorAll('button');
    console.log(`🔤 A-Z scroll guide: ${buttons.length} buttons initialized`);

    // Set up click handlers for each letter
    buttons.forEach((button) => {
      const letter = button.getAttribute('data-letter');
      
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (letter && !(button as HTMLButtonElement).disabled) {
          console.log(`🔤 Jump to letter: ${letter}`);
          
          // Add immediate visual feedback
          this.elements.azScrollGuide?.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('active');
          });
          button.classList.add('active');
          
          // Jump to the letter
          this.jumpToLetter(letter);
        }
      });
    });

    // Set up throttled scroll listener to update active letter for better performance
    let scrollTimeout: number | undefined;
    this.elements.fontLibraryList?.addEventListener('scroll', () => {
      if (scrollTimeout) {
        window.clearTimeout(scrollTimeout);
      }
      scrollTimeout = window.setTimeout(() => {
        this.updateActiveLetterInGuide();
      }, 50);
    }, { passive: true });
  }

  /**
   * Scrolls to a specific letter section in the font library.
   *
   * This function handles the complexity of sticky-positioned sections by:
   * 1. Temporarily removing sticky positioning
   * 2. Getting accurate offsetTop position
   * 3. Restoring sticky positioning
   * 4. Scrolling to the calculated position
   *
   * @param letter - The letter to scroll to (A-Z)
   */
  private jumpToLetter(letter: string) {
    const container = this.elements.fontLibraryList;

    if (!container) {
      console.error('❌ Font library list element not found');
      return;
    }

    const section = document.querySelector(`.font-letter-section[data-letter="${letter}"]`) as HTMLElement;

    if (!section) {
      console.warn(`❌ No section found for letter: ${letter}`);
      return;
    }

    const beforeScroll = container.scrollTop;
    console.log(`🔤 Jump to ${letter} (from ${beforeScroll.toFixed(0)}px)`);

    // Save and temporarily remove sticky positioning to get accurate offsetTop
    const originalPosition = section.style.position;
    section.style.position = 'static';

    // Force layout recalculation
    void section.offsetHeight;

    // Get the true position of the section
    const targetPosition = section.offsetTop;

    // Restore sticky positioning
    section.style.position = originalPosition;

    // Account for container padding
    const containerPadding = 12; // matches .font-drawer-list padding-top
    const targetScroll = Math.max(0, targetPosition - containerPadding);

    // Clamp to valid scroll range
    const maxScroll = container.scrollHeight - container.clientHeight;
    const finalScroll = Math.min(targetScroll, maxScroll);

    const direction = finalScroll < beforeScroll ? '⬆️ UP' : '⬇️ DOWN';
    console.log(`   Target: ${finalScroll.toFixed(0)}px (${direction})`);

    // Perform the scroll
    container.scrollTop = finalScroll;

    // Verify and update UI
    requestAnimationFrame(() => {
      const afterScroll = container.scrollTop;
      const delta = Math.abs(afterScroll - finalScroll);
      const success = delta < 5;

      console.log(`   Result: ${afterScroll.toFixed(0)}px | Delta: ${delta.toFixed(0)}px ${success ? '✅' : '⚠️'}`);

      // If scroll didn't work perfectly, try one more time
      if (!success && delta > 1) {
        console.log(`   Retry scroll...`);
        container.scrollTop = finalScroll;

        requestAnimationFrame(() => {
          this.updateActiveLetterInGuide();
        });
      } else {
        this.updateActiveLetterInGuide();
      }
    });
  }

  /**
   * Updates which letter is highlighted in the A-Z scroll guide based on current scroll position.
   * Handles sticky-positioned sections by temporarily removing sticky to get accurate positions.
   */
  private updateActiveLetterInGuide() {
    const guide = this.elements.azScrollGuide;
    const container = this.elements.fontLibraryList;

    if (!guide || !container) return;

    const sections = Array.from(document.querySelectorAll('.font-letter-section')) as HTMLElement[];
    const currentScrollTop = container.scrollTop;

    // Threshold: highlight the letter when its section is within 100px of the top
    const ACTIVATION_THRESHOLD = 100;

    let activeLetter = '';

    // Temporarily get positions by removing sticky
    const positions = sections.map((section) => {
      const originalPosition = section.style.position;
      section.style.position = 'static';
      const offset = section.offsetTop;
      section.style.position = originalPosition;

      return {
        letter: section.getAttribute('data-letter') || '',
        offset: offset
      };
    });

    // Find which section is currently visible at the top
    positions.forEach(({ letter, offset }) => {
      if (offset <= currentScrollTop + ACTIVATION_THRESHOLD) {
        activeLetter = letter;
      }
    });

    // Update button states
    guide.querySelectorAll('button').forEach((btn) => {
      const btnLetter = btn.getAttribute('data-letter');
      if (btnLetter === activeLetter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  private handleFontSearchInput(value: string) {
    if (this.fontSearchTimeout) {
      window.clearTimeout(this.fontSearchTimeout);
    }

    // Reduced debounce delay for faster response
    this.fontSearchTimeout = window.setTimeout(() => {
      this.applyFiltersAndSort(value);
    }, 100);
  }

  private applyFiltersAndSort(searchQuery?: string) {
    if (!this.googleFontsCatalog.length) {
      this.filteredFonts = [];
      this.renderFontResults([]);
      return;
    }

    const query = searchQuery ?? this.elements.fontSearchInput?.value ?? '';
    let results = [...this.googleFontsCatalog];

    // Apply search filter
    if (query.trim()) {
      const trimmed = query.trim().toLowerCase();
      results = results.filter(font =>
          font.family.toLowerCase().includes(trimmed) ||
          font.category.toLowerCase().includes(trimmed)
      );
    }

    // Apply category filter
    if (this.currentCategory !== 'all') {
      results = results.filter(font =>
        font.category.toLowerCase() === this.currentCategory.toLowerCase()
      );
    }

    // Apply sorting
    results = this.sortFonts(results, this.currentSort);

    // No limit - show ALL fonts for complete A-Z coverage
    // Performance is optimized via DocumentFragment rendering
    this.filteredFonts = results;
    this.renderFontResults(this.filteredFonts);
  }

  private sortFonts(fonts: GoogleFont[], sortType: string): GoogleFont[] {
    // Always sort alphabetically first for A-Z grouping
    const alphabeticallySorted = [...fonts].sort((a, b) => a.family.localeCompare(b.family));
    
    switch (sortType) {
      case 'alphabetical':
        return alphabeticallySorted;
      
      case 'trending':
        // Trending: sort by recently added + popularity (but within letter groups)
        return [...fonts].reverse();
      
      case 'date':
        // Recently added: reverse the array
        return [...fonts].reverse();
      
      case 'popularity':
      default:
        // For now, use alphabetical for better UX with A-Z guide
        return alphabeticallySorted;
    }
  }

  private updateFontPreviews() {
    const previewElements = document.querySelectorAll('.font-card-preview, .font-weight-preview');
    previewElements.forEach(el => {
      if (el.textContent !== this.currentPreviewText) {
        el.textContent = this.currentPreviewText;
      }
    });
  }

  private renderWeightPreviews(container: HTMLElement, font: GoogleFont) {
    // Map Google Fonts weight variants to readable labels
    const weightMap: { [key: string]: string } = {
      '100': 'Thin',
      '200': 'Extra Light',
      '300': 'Light',
      '400': 'Regular',
      '500': 'Medium',
      '600': 'Semi Bold',
      '700': 'Bold',
      '800': 'Extra Bold',
      '900': 'Black'
    };

    // Parse variants to get numeric weights
    const weights = font.variants
      .filter(v => /^\d+$/.test(v) || v === 'regular' || v === 'italic')
      .map(v => {
        if (v === 'regular') return '400';
        if (v === 'italic') return '400italic';
        return v;
      })
      .filter(v => !v.includes('italic')) // Filter out italic variants for cleaner display
      .sort((a, b) => parseInt(a) - parseInt(b));

    // Remove duplicates
    const uniqueWeights = [...new Set(weights)];

    if (uniqueWeights.length === 0) {
      // If no standard weights, show regular preview
      const row = document.createElement('div');
      row.className = 'font-weight-row';
      
      const label = document.createElement('span');
      label.className = 'font-weight-label';
      label.textContent = 'Regular';
      
      const preview = document.createElement('div');
      preview.className = 'font-weight-preview';
      preview.textContent = this.currentPreviewText;
      preview.style.fontFamily = `"${font.family}", ${this.getCategoryFallback(font.category)}`;
      preview.style.fontWeight = '400';
      
      row.appendChild(preview);
      row.appendChild(label);
      container.appendChild(row);
      return;
    }

    // Render each weight
    uniqueWeights.forEach(weight => {
      const row = document.createElement('div');
      row.className = 'font-weight-row';
      row.setAttribute('data-weight', weight);
      
      // Add focused class if this is the selected weight
      if (this.focusedWeight && weight === this.focusedWeight) {
        row.classList.add('focused');
      }
      
      const label = document.createElement('span');
      label.className = 'font-weight-label';
      label.textContent = weightMap[weight] || weight;
      
      const preview = document.createElement('div');
      preview.className = 'font-weight-preview';
      preview.textContent = this.currentPreviewText;
      preview.style.fontFamily = `"${font.family}", ${this.getCategoryFallback(font.category)}`;
      preview.style.fontWeight = weight;
      
      // Apply italic if requested
      if (this.showItalic) {
        preview.style.fontStyle = 'italic';
      }
      
      row.appendChild(preview);
      row.appendChild(label);
      container.appendChild(row);
    });
  }

  private async loadGoogleFontsCatalog(force: boolean = false) {
    if (this.googleFontsCatalog.length && !force) {
      this.applyFiltersAndSort();
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_FONTS_API_KEY;
    if (!apiKey) {
      this.renderFontResults([]);
      this.showFontDrawerNotice('Add VITE_GOOGLE_FONTS_API_KEY to your .env file to browse 1500+ Google Fonts.');
      return;
    }

    if (this.elements.fontLibraryList) {
      this.elements.fontLibraryList.innerHTML = `
        <div class="font-drawer-loading">
          <div class="loading-spinner"></div>
          <p>Loading Google Fonts...</p>
        </div>
      `;
    }
    this.clearFontDrawerNotice();

    try {
      const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${apiKey}`);
      if (!response.ok) throw new Error('Failed to load fonts');
      const data = await response.json();
      this.googleFontsCatalog = data.items || [];
      this.applyFiltersAndSort();
    } catch (error) {
      console.error('Google Fonts API error:', error);
      this.renderFontResults([]);
      this.showFontDrawerNotice('Unable to load Google Fonts. Check your API key or try again later.');
    }
  }

  private renderFontResults(fonts: GoogleFont[]) {
    if (!this.elements.fontLibraryList) return;
    this.elements.fontLibraryList.innerHTML = '';

    if (!fonts.length) {
      const message = document.createElement('div');
      message.className = 'font-drawer-empty';
      message.textContent = this.googleFontsCatalog.length
        ? 'No fonts found. Try adjusting your filters or search.'
        : 'Loading fonts...';
      this.elements.fontLibraryList.appendChild(message);
      this.elements.azScrollGuide?.classList.add('hidden');
      return;
    }

    // Show A-Z guide
    this.elements.azScrollGuide?.classList.remove('hidden');

    // Group fonts by first letter
    const fontsByLetter: { [key: string]: GoogleFont[] } = {};
    const availableLetters = new Set<string>();

    fonts.forEach(font => {
      const firstLetter = font.family[0].toUpperCase();
      if (!fontsByLetter[firstLetter]) {
        fontsByLetter[firstLetter] = [];
      }
      fontsByLetter[firstLetter].push(font);
      availableLetters.add(firstLetter);
    });

    // Update A-Z guide button states
    const availableLettersArray = Array.from(availableLetters).sort();
    const missingLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !availableLetters.has(l));
    
    console.log(`📚 Loaded ${fonts.length} fonts covering ${availableLettersArray.length}/26 letters: ${availableLettersArray.join('')}`);
    if (missingLetters.length > 0) {
      console.log(`⚠️ Missing letters (no fonts): ${missingLetters.join('')}`);
    } else {
      console.log(`✅ ALL 26 letters A-Z are available!`);
    }
    
    this.elements.azScrollGuide?.querySelectorAll('button').forEach(btn => {
      const letter = btn.getAttribute('data-letter');
      if (letter && availableLetters.has(letter)) {
        (btn as HTMLButtonElement).disabled = false;
      } else {
        (btn as HTMLButtonElement).disabled = true;
      }
    });

    // Render fonts grouped by letter using DocumentFragment for better performance
    const letters = Object.keys(fontsByLetter).sort();
    const fragment = document.createDocumentFragment();
    
    letters.forEach(letter => {
      // Create letter section header
      const section = document.createElement('div');
      section.className = 'font-letter-section';
      section.setAttribute('data-letter', letter);
      
      const heading = document.createElement('h3');
      heading.textContent = letter;
      section.appendChild(heading);
      
      fragment.appendChild(section);

      // Render fonts for this letter
      fontsByLetter[letter].forEach(font => {
        const card = this.createFontCard(font);
        fragment.appendChild(card);
      });
    });

    // Single DOM operation for all fonts
    this.elements.fontLibraryList?.appendChild(fragment);
    
    // Verify sections were created
    requestAnimationFrame(() => {
      const createdSections = document.querySelectorAll('.font-letter-section');
      const createdLetters = Array.from(createdSections).map(s => s.getAttribute('data-letter')).filter(Boolean);
      console.log(`✅ Rendered ${createdSections.length} letter sections: ${createdLetters.join('')}`);
    });
  }

  private createFontCard(font: GoogleFont): HTMLElement {
    const isFavorite = this.favoriteFonts.some(f => f.id === font.family.toLowerCase());
      
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

      // Check for special variants and add badges
      const hasItalic = font.variants.some(v => v.includes('italic'));
      const hasCondensed = font.family.toLowerCase().includes('condensed');
      const hasExtended = font.family.toLowerCase().includes('extended');
      const isVariable = font.variants.some(v => v.includes('variable') || v.includes('wght'));

      if (isVariable) {
        const variableBadge = document.createElement('span');
        variableBadge.className = 'font-card-badge variable';
        variableBadge.textContent = 'Variable';
        variableBadge.title = 'Variable font with adjustable weight axis';
        meta.appendChild(variableBadge);
      }

      if (hasItalic && this.showItalic) {
        const italicBadge = document.createElement('span');
        italicBadge.className = 'font-card-badge italic';
        italicBadge.textContent = 'Italic';
        meta.appendChild(italicBadge);
      }

      if (hasCondensed && this.showCondensed) {
        const condensedBadge = document.createElement('span');
        condensedBadge.className = 'font-card-badge condensed';
        condensedBadge.textContent = 'Condensed';
        meta.appendChild(condensedBadge);
      }

      if (hasExtended && this.showExtended) {
        const extendedBadge = document.createElement('span');
        extendedBadge.className = 'font-card-badge extended';
        extendedBadge.textContent = 'Extended';
        meta.appendChild(extendedBadge);
      }

      info.appendChild(title);
      info.appendChild(meta);
      header.appendChild(info);

      // Regular preview (single line)
      const preview = document.createElement('div');
      preview.className = 'font-card-preview';
      preview.textContent = this.currentPreviewText;
      preview.style.fontFamily = `"${font.family}", ${this.getCategoryFallback(font.category)}`;

      // Weight preview (multiple lines showing all weights)
      const weightsPreview = document.createElement('div');
      weightsPreview.className = 'font-card-preview-weights';
      if (this.verticalLayout) {
        weightsPreview.classList.add('vertical');
      }
      
      if (this.showAllWeights) {
        card.classList.add('expanded');
        this.renderWeightPreviews(weightsPreview, font);
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
        if (this.favoriteFonts.length >= this.maxFavoriteFonts) {
          this.showFontDrawerNotice(`Maximum ${this.maxFavoriteFonts} fonts. Remove one to add another.`);
          return;
        }
        this.handleFontSelection(font);
      });

      const applyButton = document.createElement('button');
      applyButton.type = 'button';
      applyButton.className = 'secondary';
      applyButton.textContent = 'Quick Apply';
      applyButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.quickApplyFont(font);
      });

      actions.appendChild(pinButton);
      actions.appendChild(applyButton);

      card.appendChild(header);
      card.appendChild(preview);
      card.appendChild(weightsPreview);
      card.appendChild(actions);

      // Load font CSS when card is visible (with all available weights)
      this.ensureFontStyles({
        id: font.family.toLowerCase(),
        name: font.family,
        family: `"${font.family}", ${this.getCategoryFallback(font.category)}`,
        origin: 'google',
        cssUrl: this.buildGoogleFontCss(font.family, font.variants)
      });

    return card;
  }

  private quickApplyFont(font: GoogleFont) {
    // Temporarily apply font without pinning
    const tempFont: FavoriteFont = {
      id: font.family.toLowerCase(),
      name: font.family,
      family: `"${font.family}", ${this.getCategoryFallback(font.category)}`,
      origin: 'google',
      cssUrl: this.buildGoogleFontCss(font.family)
    };

    // Apply to text displays
    if (this.elements.textDisplay) {
      this.elements.textDisplay.style.fontFamily = tempFont.family;
    }
    if (this.elements.mobileTextDisplay) {
      this.elements.mobileTextDisplay.style.fontFamily = tempFont.family;
    }
    if (this.elements.fontName) {
      this.elements.fontName.textContent = `${tempFont.name} (Preview)`;
    }

    this.keyboard.updateKeyCapFont(tempFont.family, tempFont.name);
    showToast(`Previewing ${font.family}. Pin it to save.`, false);
  }

  private async handleFontSelection(font: GoogleFont) {
    if (this.favoriteFonts.length >= this.maxFavoriteFonts) {
      this.showFontDrawerNotice(`Limit reached. Remove a font to add another (max ${this.maxFavoriteFonts}).`);
      return;
    }

    const favorite: FavoriteFont = {
      id: font.family.toLowerCase(),
      name: font.family,
      family: `"${font.family}", ${this.getCategoryFallback(font.category)}`,
      origin: 'google',
      cssUrl: this.buildGoogleFontCss(font.family)
    };

    this.favoriteFonts.push(favorite);
    this.currentFontIndex = this.favoriteFonts.length - 1;
    this.persistFavoriteFonts();
    await this.ensureFontStyles(favorite);
    this.renderFavoriteChips();
    this.renderFontResults(this.filteredFonts);
    this.updateFont();
    this.clearFontDrawerNotice();
  }

  private removeFavoriteFont(fontId: string) {
    if (this.favoriteFonts.length <= 1) {
      this.showFontDrawerNotice('Keep at least one font in your palette.');
      return;
    }

    const index = this.favoriteFonts.findIndex(font => font.id === fontId);
    if (index === -1) return;

    this.favoriteFonts.splice(index, 1);
    if (this.currentFontIndex >= this.favoriteFonts.length) {
      this.currentFontIndex = this.favoriteFonts.length - 1;
    }

    this.persistFavoriteFonts();
    this.renderFavoriteChips();
    this.renderFontResults(this.filteredFonts);
    this.updateFont();
  }

  private getCategoryFallback(category: string = '') {
    const normalized = category.toLowerCase();
    if (normalized.includes('serif')) return 'serif';
    if (normalized.includes('mono')) return 'monospace';
    if (normalized.includes('hand')) return '"Comic Neue", cursive';
    if (normalized.includes('display')) return '"Helvetica Neue", system-ui, sans-serif';
    return 'system-ui, -apple-system, sans-serif';
  }

  private showFontDrawerNotice(message: string) {
    if (!this.elements.fontDrawerNotice) return;
    this.elements.fontDrawerNotice.textContent = message;
    this.elements.fontDrawerNotice.classList.remove('hidden');
  }

  private clearFontDrawerNotice() {
    if (this.elements.fontDrawerNotice) {
      this.elements.fontDrawerNotice.classList.add('hidden');
      this.elements.fontDrawerNotice.textContent = '';
    }
  }

  private setupThemeToggle() {
    // The theme-toggle module wires the #themeToggle click; here we only hide it when disabled.
    // (#settingsToggle is now owned by the settings-panel module.)
    if (!this.config.features.themeToggle) {
      document.getElementById('themeToggle')?.classList.add('hidden');
    }
  }


}