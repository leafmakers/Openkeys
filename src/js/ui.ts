import * as THREE from 'three';
import type { OpenKeysConfig } from './config';

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
  private isDarkMode: boolean = false;
  private config: OpenKeysConfig;
  private settingsPanelEl: HTMLElement | null = null;
  private keyboard: Record<string, any>;
  private renderer: THREE.WebGLRenderer;
  private maxCharacters: number;
  private isUpdating: boolean;
  private hasInteracted: boolean;
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
  private typingStats: {
    startTime: number | null;
    endTime: number | null;
    characterCount: number;
    currentWPM: number;
    isTyping: boolean;
  };

  constructor(keyboard: any, renderer: any, config: OpenKeysConfig) {
    this.keyboard = keyboard;
    this.renderer = renderer;
    this.config = config;
    this.maxCharacters = config.features.maxCharacters;
    this.isUpdating = false;
    this.hasInteracted = false;

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
    this.typingStats = {
      startTime: null,
      endTime: null,
      characterCount: 0,
      currentWPM: 0,
      isTyping: false
    };
    this.setupElements();
    this.setupEventListeners();
    this.loadThemePreference();
    this.initializeFontFavorites();
    this.applyPosterVisibility();

    // Apply initial text from config (e.g. ?text=...) once the keyboard mesh is ready,
    // otherwise show the placeholder with a blinking cursor.
    const initialText = (this.config.text || '').slice(0, this.maxCharacters);
    if (initialText) {
      this.hasInteracted = true;
      this.keyboard.setOnReady(() => this.updateDisplays(initialText));
    } else {
      this.updateDisplays('');
    }
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

  private showError(message: string, isError: boolean = true) {
    const messageDiv = document.createElement('div');
    
    if (isError) {
      messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #fee2e2;
        color: #991b1b;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: system-ui;
        font-size: 14px;
        border: 1px solid #fecaca;
        z-index: 2000;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      `;
    } else {
      messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #d1fae5;
        color: #065f46;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: system-ui;
        font-size: 14px;
        border: 1px solid #a7f3d0;
        z-index: 2000;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      `;
    }
    
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.style.opacity = '0';
      messageDiv.style.transition = 'opacity 0.3s ease';
      setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
  }

  private loadThemePreference() {
    // Precedence: explicit ?theme= URL param (already merged into config) > saved pref > config default
    const urlHasTheme = new URLSearchParams(window.location.search).has('theme');
    const savedTheme = localStorage.getItem('theme');
    if (urlHasTheme) {
      this.isDarkMode = this.config.theme.mode === 'dark';
    } else if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    } else {
      this.isDarkMode = this.config.theme.mode === 'dark';
    }
    this.applyTheme();
  }

  /** Public theme toggle used by the navbar button. */
  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme();
  }

  /** Build a shareable URL that reproduces the current configuration. */
  private buildShareUrl(overrides: Record<string, string> = {}): string {
    const params = new URLSearchParams();
    const text = this.getDisplayText();
    if (text) params.set('text', text);
    if (this.config.layout.preset && this.config.layout.preset !== 'qwerty') {
      params.set('layout', this.config.layout.preset);
    }
    params.set('theme', this.isDarkMode ? 'dark' : 'light');
    if (!this.config.animation.intro.enabled) params.set('intro', '0');
    if (!this.config.features.poster) params.set('poster', '0');
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === undefined || v === '') params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return `${location.origin}${location.pathname}${qs ? '?' + qs : ''}`;
  }

  private applyPosterVisibility() {
    const show = this.config.features.poster;
    if (this.elements.previewAndPrint) {
      (this.elements.previewAndPrint as HTMLElement).style.display = show ? '' : 'none';
    }
  }

  private toggleSettingsPanel() {
    if (!this.settingsPanelEl) this.setupSettingsPanel();
    if (this.settingsPanelEl) {
      this.settingsPanelEl.classList.toggle('open');
    }
  }

  private setupSettingsPanel() {
    if (this.settingsPanelEl) return;

    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.className = 'settings-panel';
    panel.innerHTML = `
      <div class="settings-header">
        <span>Settings</span>
        <button id="settingsClose" class="settings-close" aria-label="Close settings">×</button>
      </div>
      <label class="settings-field">
        <span>Keyboard layout</span>
        <select id="settingsLayout">
          <option value="qwerty">QWERTY</option>
          <option value="azerty">AZERTY</option>
          <option value="dvorak">Dvorak</option>
          <option value="numpad">Numpad</option>
        </select>
      </label>
      <div class="settings-field">
        <span>Theme</span>
        <div class="settings-segment" id="settingsTheme">
          <button data-theme="light">Light</button>
          <button data-theme="dark">Dark</button>
        </div>
      </div>
      <label class="settings-check">
        <input type="checkbox" id="settingsIntro" />
        <span>Intro spin animation</span>
      </label>
      <label class="settings-check">
        <input type="checkbox" id="settingsPoster" />
        <span>Show "Preview Poster" button</span>
      </label>
      <button id="settingsShare" class="settings-share">Copy shareable link</button>
      <p class="settings-hint">Layout changes reload the page with your text preserved.</p>
    `;
    document.body.appendChild(panel);
    this.settingsPanelEl = panel;

    // Initialize control state
    const layoutSel = panel.querySelector('#settingsLayout') as HTMLSelectElement;
    layoutSel.value = this.config.layout.preset || 'qwerty';
    const introChk = panel.querySelector('#settingsIntro') as HTMLInputElement;
    introChk.checked = this.config.animation.intro.enabled;
    const posterChk = panel.querySelector('#settingsPoster') as HTMLInputElement;
    posterChk.checked = this.config.features.poster;
    this.syncThemeSegment();

    // Wire controls
    panel.querySelector('#settingsClose')?.addEventListener('click', () => this.toggleSettingsPanel());

    layoutSel.addEventListener('change', () => {
      // Structural change → reload with the new layout (text preserved via URL)
      location.assign(this.buildShareUrl({ layout: layoutSel.value === 'qwerty' ? '' : layoutSel.value }));
    });

    panel.querySelector('#settingsTheme')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-theme]') as HTMLElement | null;
      if (!btn) return;
      const wantDark = btn.dataset.theme === 'dark';
      if (wantDark !== this.isDarkMode) this.toggleTheme();
      this.syncThemeSegment();
    });

    introChk.addEventListener('change', () => {
      location.assign(this.buildShareUrl({ intro: introChk.checked ? '' : '0' }));
    });

    posterChk.addEventListener('change', () => {
      this.config.features.poster = posterChk.checked;
      this.applyPosterVisibility();
    });

    const shareBtn = panel.querySelector('#settingsShare') as HTMLButtonElement;
    shareBtn.addEventListener('click', async () => {
      const url = this.buildShareUrl();
      try {
        await navigator.clipboard.writeText(url);
        shareBtn.textContent = 'Copied!';
        setTimeout(() => (shareBtn.textContent = 'Copy shareable link'), 1500);
      } catch {
        this.showError(url, false);
      }
    });
  }

  private syncThemeSegment() {
    if (!this.settingsPanelEl) return;
    this.settingsPanelEl.querySelectorAll('#settingsTheme button').forEach((b) => {
      const el = b as HTMLElement;
      el.classList.toggle('active', el.dataset.theme === (this.isDarkMode ? 'dark' : 'light'));
    });
  }

  private applyTheme() {
    const colors = this.isDarkMode ? this.config.theme.dark : this.config.theme.light;
    document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
    document.body.style.background = colors.background;
    this.keyboard.scene.scene.background = new THREE.Color(colors.background);


    // Update keyboard theme
    this.keyboard.updateTheme(this.isDarkMode);
    
    // Update floor theme
    this.keyboard.scene.updateFloorTheme(this.isDarkMode);
    
    // Update character bar colors for current theme
    this.updateCharacterBar(this.getDisplayText());
    
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
  }

  // Removed unused updateSliderPosition method

  private setupEventListeners() {
    this.setupButtonListeners();
    this.setupTextInputListeners();
    this.setupKeyboardListeners();
    this.setupPreviewListeners();
    this.setupThemeToggle();
    this.setupFontControls();
    this.setupCharacterBarEvents();
  }

  private setupCharacterBarEvents() {
    // Listen for character bar updates during typing animation
    document.addEventListener('updateCharacterBar', ((event: Event) => {
      const customEvent = event as CustomEvent<{ text: string }>;
      const { text } = customEvent.detail;
      this.updateCharacterBar(text);
    }) as EventListener);
  }

  private setupButtonListeners() {
    this.elements.heightUpBtn?.addEventListener('click', () => {
      // Visual feedback - make Castle button active
      this.elements.heightUpBtn?.classList.add('active');
      this.elements.heightDownBtn?.classList.remove('active');
      this.keyboard.increaseHeight();
      this.updateKeyboardFromText(this.getDisplayText());
    });

    this.elements.heightDownBtn?.addEventListener('click', async () => {
      // Visual feedback - make Clear button active during animation
      this.elements.heightDownBtn?.classList.add('active');
      this.elements.heightUpBtn?.classList.remove('active');
      this.keyboard.decreaseHeight();
      await this.keyboard.clear();
      
      setTimeout(() => {
        // Switch back to Castle being active after clear animation
        this.elements.heightUpBtn?.classList.add('active');
        this.elements.heightDownBtn?.classList.remove('active');
        this.keyboard.increaseHeight();
        // Reset displays after animation completes
        this.resetTextDisplays();
      }, 500);
    });

    this.elements.clearButton?.addEventListener('click', async () => {
      // Temporarily activate Clear button during clear operation
      this.elements.heightDownBtn?.classList.add('active');
      this.elements.heightUpBtn?.classList.remove('active');
      
      await this.keyboard.clear();
      
      setTimeout(() => {
        // Switch back to Castle being active
        this.elements.heightUpBtn?.classList.add('active');
        this.elements.heightDownBtn?.classList.remove('active');
        this.keyboard.increaseHeight();
        // Reset displays after animation completes
        this.resetTextDisplays();
      }, 500);
    });

    this.elements.shadowAngle?.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const angle = (parseInt(target.value) * Math.PI) / 180;
      this.keyboard.scene.updateLightPosition(angle);
    });
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
    this.showError(`Previewing ${font.family}. Pin it to save.`, false);
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
    const themeToggle = document.getElementById('themeToggle');
    if (this.config.features.themeToggle) {
      themeToggle?.addEventListener('click', () => this.toggleTheme());
    } else {
      themeToggle?.classList.add('hidden');
    }

    const settingsToggle = document.getElementById('settingsToggle');
    if (this.config.features.settingsPanel) {
      settingsToggle?.addEventListener('click', () => this.toggleSettingsPanel());
    } else {
      settingsToggle?.classList.add('hidden');
    }
  }

  private setupTextInputListeners() {
    const handleInput = (element: HTMLElement) => {
      if (this.isUpdating) return;
      
      const text = element.textContent || '';
      
      // Track typing session for WPM calculation
      this.trackTypingSession(text);
      
      if (!this.hasInteracted && text.trim()) {
        this.hasInteracted = true;
      }

      if (text.length > this.maxCharacters) {
        // Save cursor position before truncating
        const selection = window.getSelection();
        let cursorPosition = 0;
        
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          cursorPosition = range.startOffset;
        }
        
        // Truncate text
        const truncatedText = text.slice(0, this.maxCharacters);
        element.textContent = truncatedText;
        
        // Restore cursor position (but not beyond the truncated length)
        const newCursorPosition = Math.min(cursorPosition, truncatedText.length);
        this.setCursorToEnd(element, newCursorPosition);
        
        this.updateDisplays(truncatedText);
        return;
      }

      // Skip text update to preserve cursor position during normal typing
      this.updateDisplays(text, true);
    };

    [this.elements.textDisplay, this.elements.mobileTextDisplay].forEach(element => {
      if (!element) return;
      
      element.addEventListener('input', () => {
        handleInput(element);
      });
      element.addEventListener('focus', () => {
        if (!this.hasInteracted) {
          element.textContent = '';
          this.updateDisplays('');
          this.hasInteracted = true;
        }
      });
      element.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
          if (this.config.features.poster) {
            this.showPreview();
          }
        }
      });
      element.addEventListener('paste', (e: ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text') || '';
        const cleanText = text.replace(/\n/g, ' ').trim();
        
        if (!this.hasInteracted) {
          this.hasInteracted = true;
          element.textContent = '';
        }

        // For mobile, use a simpler approach to avoid cursor issues
        const isMobile = window.innerWidth <= 480;
        if (isMobile && element === this.elements.mobileTextDisplay) {
          const currentText = element.textContent || '';
          const newText = currentText + cleanText;
          element.textContent = newText.slice(0, this.maxCharacters);
        } else {
          const selection = window.getSelection();
          if (!selection) return;
          
          const range = selection.getRangeAt(0);
          const cursorPosition = range.startOffset;

          const currentText = element.textContent || '';
          const newText = currentText.slice(0, cursorPosition) + cleanText + currentText.slice(cursorPosition);
          element.textContent = newText.slice(0, this.maxCharacters);
        }
        
        this.updateDisplays(element.textContent || '');
      });
    });
  }

  private setupKeyboardListeners() {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Don't capture keystrokes while the poster preview is open or an input is focused
      const previewModal = document.getElementById('previewModal');
      const isModalOpen = previewModal?.style.display === 'block';
      const isInputFocused = document.activeElement?.tagName === 'INPUT' ||
                            document.activeElement?.tagName === 'TEXTAREA' ||
                            this.elements.textDisplay?.matches(':focus') ||
                            this.elements.mobileTextDisplay?.matches(':focus');

      if (!isInputFocused && !isModalOpen) {
        this.handleUnfocusedKeyPress(e);
      }
    });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        this.elements.previewAndPrint?.click();
      }
    });

    // Add spacebar trigger for Preview & Print (desktop only)
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        // Don't trigger preview while it's already open or an input is focused
        const previewModal = document.getElementById('previewModal');
        const isModalOpen = previewModal?.style.display === 'block';
        const isInputFocused = document.activeElement?.tagName === 'INPUT' ||
                              document.activeElement?.tagName === 'TEXTAREA' ||
                              this.elements.textDisplay?.matches(':focus') ||
                              this.elements.mobileTextDisplay?.matches(':focus');

        // Only trigger if not focused on any inputs, modal not open, and not on mobile
        if (!isInputFocused && !isModalOpen && window.innerWidth > 480) {
          e.preventDefault();
          this.showPreview();
        }
      }
    });

    // Add double tap detection for mobile
    this.setupMobileDoubleTap();
  }

  private handleUnfocusedKeyPress(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    const currentText = this.getDisplayText();
    
    if (e.key === 'Backspace') {
      if (currentText) {
        const newText = currentText.slice(0, -1);
        this.updateDisplays(newText);
        this.trackTypingSession(newText);
      }
      return;
    }

    // Skip space handling here since it's handled in setupKeyboardListeners for preview trigger
    if ((key === ' ' || e.code === 'Space') && window.innerWidth <= 480) {
      e.preventDefault();
      if (currentText.length < this.maxCharacters) {
        const newText = this.hasInteracted ? currentText + ' ' : ' ';
        this.updateDisplays(newText);
        this.trackTypingSession(newText);
        this.hasInteracted = true;
      }
      return;
    }

    if (this.keyboard.keyObjects[key] && currentText.length < this.maxCharacters) {
      this.hasInteracted = true;
      const newText = currentText + key;
      this.updateDisplays(newText);
      this.trackTypingSession(newText);
    }
  }

  private setupMobileDoubleTap() {
    // Implementation for mobile double tap
  }

  private setupPreviewListeners() {
    this.elements.previewAndPrint?.addEventListener('click', () => {
      this.showPreview();
    });

    this.elements.closePreview?.addEventListener('click', () => {
      this.hidePreview();
    });

    this.elements.printFromPreview?.addEventListener('click', () => {
      this.downloadPoster();
    });

    // Close preview modal when clicking outside
    this.elements.previewModal?.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.elements.previewModal) {
        this.hidePreview();
      }
    });

    // Handle Escape key to close preview
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Check if preview modal is open
        if (this.elements.previewModal?.style.display === 'block') {
          e.preventDefault();
          this.hidePreview();
        }
      }
    });

    // Additional ESC key handler with event delegation for better reliability
    document.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.elements.previewModal?.style.display === 'block') {
          e.preventDefault();
          e.stopPropagation();
          this.hidePreview();
        }
      }
    });
  }

  private getDisplayText(): string {
    const text = this.elements.textDisplay?.textContent?.trim() || '';
    return this.hasInteracted ? text : '';
  }

  private updateDisplays(text: string, skipTextUpdate = false) {
    const displayText = !this.hasInteracted && !text
      ? 'type something…'
      : text;
    
    // Set placeholder attribute for blinking cursor
    const isPlaceholder = !this.hasInteracted && !text;
    
    // Only update textContent if explicitly requested (to avoid cursor reset)
    if (!skipTextUpdate) {
      if (this.elements.textDisplay) {
        this.elements.textDisplay.textContent = displayText;
        if (isPlaceholder) {
          this.elements.textDisplay.setAttribute('data-placeholder', 'true');
        } else {
          this.elements.textDisplay.removeAttribute('data-placeholder');
        }
      }
      if (this.elements.mobileTextDisplay) {
        this.elements.mobileTextDisplay.textContent = displayText;
        if (isPlaceholder) {
          this.elements.mobileTextDisplay.setAttribute('data-placeholder', 'true');
        } else {
          this.elements.mobileTextDisplay.removeAttribute('data-placeholder');
        }
      }
    } else {
      // Just update placeholder attributes without touching textContent
      if (this.elements.textDisplay) {
        if (isPlaceholder) {
          this.elements.textDisplay.setAttribute('data-placeholder', 'true');
        } else {
          this.elements.textDisplay.removeAttribute('data-placeholder');
        }
      }
      if (this.elements.mobileTextDisplay) {
        if (isPlaceholder) {
          this.elements.mobileTextDisplay.setAttribute('data-placeholder', 'true');
        } else {
          this.elements.mobileTextDisplay.removeAttribute('data-placeholder');
        }
      }
    }

    this.updateCharacterCount(text);
    this.updateKeyboardFromText(text);
    this.updateTypingSpeedDisplay();
  }

  private resetTextDisplays() {
    this.hasInteracted = false;
    
    // Clear text displays without forcing cursor position
    if (this.elements.textDisplay) {
      this.elements.textDisplay.textContent = '';
      this.elements.textDisplay.removeAttribute('data-placeholder');
      // Force text direction
      this.elements.textDisplay.style.direction = 'ltr';
      this.elements.textDisplay.style.textAlign = 'left';
    }
    if (this.elements.mobileTextDisplay) {
      this.elements.mobileTextDisplay.textContent = '';
      this.elements.mobileTextDisplay.removeAttribute('data-placeholder');  
      // Force text direction
      this.elements.mobileTextDisplay.style.direction = 'ltr';
      this.elements.mobileTextDisplay.style.textAlign = 'left';
    }
    
    this.updateDisplays('');
    this.resetTypingStats();
  }
  
  
  private setCursorToEnd(element: HTMLElement, position?: number) {
    try {
      const range = document.createRange();
      const selection = window.getSelection();
      
      if (element.childNodes.length > 0) {
        const textNode = element.childNodes[0];
        const textLength = textNode.textContent?.length || 0;
        const cursorPos = position !== undefined ? Math.min(position, textLength) : textLength;
        range.setStart(textNode, cursorPos);
        range.setEnd(textNode, cursorPos);
      } else {
        range.setStart(element, 0);
        range.setEnd(element, 0);
      }
      
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch (error) {
      // Ignore cursor positioning errors
      console.debug('Could not set cursor to end:', error);
    }
  }

  private updateCharacterCount(text: string) {
    const count = text.length;
    if (this.elements.characterCount) {
      this.elements.characterCount.textContent = `${count}/${this.maxCharacters} characters`;
    }
    
    if (this.elements.characterBarSegments) {
      this.updateCharacterBar(text);
    }
  }

  private resetTypingStats(): void {
    this.typingStats = {
      startTime: null,
      endTime: null,
      characterCount: 0,
      currentWPM: 0,
      isTyping: false
    };
    this.updateTypingSpeedDisplay();
  }
  
  private hidePreview(): void {
    if (this.elements.previewModal) {
      this.elements.previewModal.style.display = 'none';
    }
  }
  
  private downloadPoster(): void {
    try {
      // Generate the poster image canvas
      const canvas = this.generatePosterImage();
      
      // Create download link
      const link = document.createElement('a');
      const currentText = this.getDisplayText();
      const fileName = currentText 
        ? `keycastle-poster-${currentText.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}.png`
        : 'keycastle-poster.png';
      
      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          // Show success message
          this.showError('Poster downloaded successfully!', false);
        }
      }, 'image/png', 1.0);
      
    } catch (error) {
      console.error('Error downloading poster:', error);
      this.showError('Failed to download poster. Please try again.');
    }
  }

  private showPreview(): void {
    if (!this.elements.previewModal || !this.elements.previewImage) return;
    
    try {
      const canvas = this.generatePosterImage();
      this.elements.previewImage.src = canvas.toDataURL('image/png');
      this.elements.previewModal.style.display = 'block';
    } catch (error) {
      console.error('Error generating preview:', error);
      this.showError('Failed to generate preview. Please try again.');
    }
  }

  // Canvas utility method to draw rounded rectangles
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: boolean = false,
    stroke: boolean = true
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
    if (fill) {
      ctx.fill();
    }
    if (stroke) {
      ctx.stroke();
    }
  }

  // Draw a label for a segment in the character bar
  private drawSegmentLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    count: number,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string = '#000',
    bgColor: string = '#fff'
  ): void {
    // Save the current context state
    ctx.save();
    
    // Draw background with rounded corners if bgColor is not transparent
    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      this.roundRect(ctx, x, y, width, height, 4, true, false);
    }
    
    // Set up text styling with dynamic font size - increased minimum size
    let fontSize = Math.min(20, height * 0.7); // Increased from 12 and 0.6
    let textWidth: number;
    
    // Include count in the label if it's greater than 1
    const displayText = count > 1 ? `${text} (${count})` : text;
    
    // Find the largest font size that fits
    do {
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`; // Made bold (600)
      textWidth = ctx.measureText(displayText).width;
      if (textWidth <= width - 10) break;
      fontSize -= 0.5;
    } while (fontSize > 12); // Increased minimum from 8 to 12
    
    // Set final text style
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Calculate text position
    const textX = x + (width / 2);
    const textY = y + (height / 2);
    
    // Draw text
    ctx.fillText(displayText, textX, textY); // Use displayText instead of just text
    
    // Restore the context state
    ctx.restore();
  }

  private updateTypingSpeedDisplay(): void {
    if (!this.elements.typingSpeedDisplay) return;
    
    const wpm = this.typingStats.currentWPM || 0;
    this.elements.typingSpeedDisplay.textContent = `${wpm} WPM`;
    
    // Optional: Add visual feedback based on typing speed
    if (wpm > 60) {
      this.elements.typingSpeedDisplay.style.color = '#4CAF50'; // Green for fast typing
    } else if (wpm > 30) {
      this.elements.typingSpeedDisplay.style.color = '#FFC107'; // Yellow for moderate
    } else {
      this.elements.typingSpeedDisplay.style.color = '#F44336'; // Red for slow
    }
  }

  private trackTypingSession(text: string): void {
    const now = Date.now();
    
    // Start new session if not already typing
    if (!this.typingStats.isTyping) {
      this.typingStats.startTime = now;
      this.typingStats.characterCount = 0;
      this.typingStats.isTyping = true;
    }
    
    // Update character count
    this.typingStats.characterCount = text.length;
    
    // Calculate WPM (assuming average word length of 5 characters)
    if (this.typingStats.startTime) {
      const minutes = (now - this.typingStats.startTime) / (1000 * 60);
      this.typingStats.currentWPM = Math.round((text.length / 5) / Math.max(0.1, minutes));
    }
    
    // Update typing speed display
    this.updateTypingSpeedDisplay();
  }

  private updateCharacterBar(text: string) {
    if (!this.elements.characterBarSegments) return;
    this.elements.characterBarSegments.innerHTML = '';
    if (!text || text === 'type something…' || !this.hasInteracted) return;

    const letterCount: { [key: string]: number } = {};
    text.toLowerCase().split('').forEach(char => {
      // Count all letters and numbers, not just keyboard keys that are loaded
      if (/[a-z0-9]/.test(char)) {
        letterCount[char] = (letterCount[char] || 0) + 1;
      }
    });

    // Only proceed if we have character counts
    if (Object.keys(letterCount).length === 0) return;

    // Calculate max characters based on available width
    const maxChars = this.calculateMaxCharactersForWidth(window.innerWidth);

    const sortedChars = Object.entries(letterCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, maxChars);

    const othersCount = Object.entries(letterCount)
      .slice(maxChars)
      .reduce((sum, [,count]) => sum + count, 0);

    sortedChars.forEach(([char, count], index) => {
      this.addCharacterBarSegment(char, count, index === 0, index === sortedChars.length - 1 && othersCount === 0);
    });

    if (othersCount > 0) {
      this.addOthersSegment(othersCount);
    }
  }

  private addCharacterBarSegment(char: string, count: number, isFirst: boolean, isLast: boolean) {
    if (!this.elements.characterBarSegments) return;

    const segment = document.createElement('div');
    segment.className = 'bar-segment';
    segment.style.flexGrow = count.toString();
    
    // Apply fill color with opacity based on count
    const fillColor = this.getCharacterFillColor(char, count);
    segment.style.background = fillColor;
    
    if (isFirst) {
      segment.style.borderTopLeftRadius = '4px';
      segment.style.borderBottomLeftRadius = '4px';
    }
    if (isLast) {
      segment.style.borderTopRightRadius = '4px';
      segment.style.borderBottomRightRadius = '4px';
    }

    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = `${char} (${count})`;

    const line = document.createElement('div');
    line.className = 'bar-line';

    segment.appendChild(line);
    segment.appendChild(label);
    this.elements.characterBarSegments.appendChild(segment);
  }

  private getCharacterFillColor(char: string, count: number): string {
    // Use character code to create a consistent color
    const charCode = char.charCodeAt(0);
    // Create a hue based on the character code (0-360)
    const hue = (charCode * 137.5) % 360; // Using golden angle for better distribution
    // Base saturation and lightness with some variation
    const saturation = 70 + (charCode % 20); // 70-90%
    const lightness = 50 + (charCode % 10) - 5; // 45-55%
    
    // Adjust opacity based on count
    const opacity = Math.min(0.2 + (count * 0.02), 0.8);
    
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`;
  }

  private addOthersSegment(count: number) {
    if (!this.elements.characterBarSegments) return;

    const segment = document.createElement('div');
    segment.className = 'bar-segment';
    segment.style.flexGrow = count.toString();
    
    // Use white fill in dark mode, black in light mode for others segment
    const othersColor = this.isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
    segment.style.background = othersColor;
    segment.style.borderTopRightRadius = '4px';
    segment.style.borderBottomRightRadius = '4px';

    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = `others (${count})`;

    const line = document.createElement('div');
    line.className = 'bar-line';

    segment.appendChild(line);
    segment.appendChild(label);
    this.elements.characterBarSegments.appendChild(segment);
  }

  // Single implementation of calculateMaxCharactersForWidth
  private calculateMaxCharactersForWidth(width: number): number {
    // Calculate max characters based on available screen width
    // Each character segment needs ~60-100px minimum for readability
    // Account for margins and spacing
    
    if (width <= 320) return 2;      // Very small phones
    if (width <= 480) return 3;      // Small phones
    if (width <= 640) return 4;      // Large phones / small tablets
    if (width <= 900) return 5;      // Tablets / small desktops
    if (width <= 1200) return 6;     // Medium desktops
    return 7;                        // Large desktops
  }

  private updateKeyboardFromText(text: string) {
    if (this.isUpdating) return;
    this.isUpdating = true;
    
    try {
      this.keyboard.updateFromText(text);
    } catch (error) {
      console.error('Error updating keyboard:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  private generatePosterImage(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    const width = this.renderer.domElement.width;
    const height = this.renderer.domElement.height;
    canvas.width = width;
    canvas.height = height;
    
    // Draw the 3D scene
    ctx.drawImage(this.renderer.domElement, 0, 0);
    
    // Add text overlay
    const text = this.getDisplayText();
    if (text) {
      this.drawPosterText(ctx, text, width, height);
    }
    
    return canvas;
  }

  private drawPosterText(ctx: CanvasRenderingContext2D, text: string, width: number, height: number) {
    const isMobile = window.innerWidth <= 480;
    
    // Calculate responsive font sizes based on viewport dimensions
    const baseSize = Math.min(width, height) * 0.08; // 8% of smaller dimension
    const titleSize = Math.max(36, Math.min(120, baseSize)); // Clamp between 36-120px
    const statsSize = isMobile ? titleSize * 0.4 : titleSize * 0.28; // Desktop: 30% smaller
    const labelSize = titleSize * 0.15; // Labels are 15% of title
    
    // Calculate responsive margins based on viewport dimensions
    const baseSideMargin = Math.min(width, height) * 0.08; // 8% of smaller dimension
    const baseTopMargin = Math.min(width, height) * 0.15; // 15% of smaller dimension
    const sideMargin = Math.max(24, Math.min(120, baseSideMargin)); // Clamp between 24-120px
    const topMargin = Math.max(50, Math.min(200, baseTopMargin)); // Clamp between 50-200px
    
    const config = {
      margin: {
        side: sideMargin,
        top: topMargin
      },
      title: {
        fontSize: titleSize,
        color: this.isDarkMode ? '#ffffff' : '#000000',
        lineHeight: Math.round(titleSize),
        maxWidth: isMobile ? width * 0.8 : width * 0.7
      },
      stats: {
        font: `500 ${Math.round(statsSize)}px system-ui`,
        fontSize: Math.round(statsSize),
        color: this.isDarkMode ? '#cccccc' : '#333333',
        spacing: isMobile ? 32 : 48
      },
      bar: {
        height: isMobile ? 24 : 36, // Increased from 12:18 to 24:36 for better visibility
        spacing: isMobile ? 48 : 60,
        labelFont: `600 ${Math.round(labelSize)}px system-ui`,
        bottomMargin: isMobile ? 72 : 120,
        lineHeight: Math.round(labelSize * 1.5)
      }
    };

    // Calculate positions to prevent overlap
    const barY = height - config.bar.bottomMargin - 10;
    const titleEndY = this.drawTitle(ctx, text, config);
    const statsY = isMobile ? titleEndY + 20 : barY - config.stats.spacing - 64;
    
    this.drawStats(ctx, text, config, statsY);
    this.drawCharacterBar(ctx, text, config, width, height, isMobile);
  }

  private drawTitle(ctx: CanvasRenderingContext2D, text: string, config: any) {
    if (!this.favoriteFonts.length) {
      return config.margin.top;
    }
    const currentFont = this.favoriteFonts[this.currentFontIndex];
    const fontSize = Math.round(config.title.fontSize);
    
    ctx.font = `500 ${fontSize}px ${currentFont.family}`;
    
    ctx.fillStyle = config.title.color;
    ctx.textAlign = 'left';
    
    const words = text.split(' ');
    const lines = this.getTextLines(words, ctx, config.title.maxWidth);
    
    let currentY = config.margin.top;
    lines.forEach(line => {
      ctx.fillText(line, config.margin.side, currentY);
      currentY += config.title.lineHeight;
    });

    return currentY;
  }

  private getTextLines(words: string[], ctx: CanvasRenderingContext2D, maxWidth: number): string[] {
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);
    
    return lines;
  }

  private drawStats(ctx: CanvasRenderingContext2D, text: string, config: any, yPosition: number) {
    const letterCount: { [key: string]: number } = {};
    text.toLowerCase().split('').forEach(char => {
      if (this.keyboard.keyObjects[char]) {
        letterCount[char] = (letterCount[char] || 0) + 1;
      }
    });
    
    const totalChars = Object.values(letterCount).reduce((sum, count) => sum + count, 0);
    const uniqueChars = Object.keys(letterCount).length;
   const currentFontName = this.favoriteFonts[this.currentFontIndex]?.name ?? 'System';
    
    ctx.font = config.stats.font;
    ctx.fillStyle = config.stats.color;
    ctx.textAlign = 'left';
   
   // Draw first line - character stats
   ctx.fillText(
     `${totalChars} characters · ${uniqueChars} unique keys`,
     config.margin.side,
     yPosition
   );
   
   // Draw second line - font in use
  // Use bold weight for the font name line
  ctx.font = `700 ${Math.round(config.stats.fontSize)}px system-ui`;
  const lineHeight = Math.round(config.stats.fontSize * 1.2); // Use actual font size for proper spacing
   ctx.fillText(
     `In use: ${currentFontName}`,
     config.margin.side,
     yPosition + lineHeight
   );
  }

  private drawCharacterBar(
    ctx: CanvasRenderingContext2D,
    text: string,
    config: {
      bar: { bottomMargin: number; height?: number };
      margin: { side: number };
    },
    width: number,
    height: number,
    _isMobile: boolean = false
  ): void {
    if (!config?.bar?.bottomMargin || !config?.margin?.side) {
      console.error('Invalid config object for drawCharacterBar');
      return;
    }

    const barY = height - config.bar.bottomMargin;
    const barWidth = width - (config.margin.side * 2);
    const barHeight = config.bar.height || 30; // Default height if not specified
    
    const letterCount: { [key: string]: number } = {};
    text.toLowerCase().split('').forEach(char => {
      if (/[a-z0-9]/.test(char)) {
        letterCount[char] = (letterCount[char] || 0) + 1;
      }
    });
    
    const totalChars = Object.values(letterCount).reduce((sum, count) => sum + count, 0);
    if (totalChars === 0) return;
    
    // Calculate max characters based on available width
    const maxChars = this.calculateMaxCharactersForWidth(width);
    
    const sortedChars = Object.entries(letterCount)
      .sort(([,a], [,b]) => (b as number) - (a as number));
    
    const topChars = sortedChars.slice(0, maxChars);
    const othersCount = sortedChars.slice(maxChars)
      .reduce((sum, [,count]) => sum + (count as number), 0);
    
    let currentX = config.margin.side;
    
    // Draw character segments
    topChars.forEach(([char, count], index) => {
      const segmentWidth = (count as number / totalChars) * barWidth;
      if (segmentWidth > 0) {
        this.drawCharacterSegment(
          ctx,
          char,
          count as number,
          currentX,
          barY,
          segmentWidth,
          barHeight,
          index === 0,
          index === topChars.length - 1 && othersCount === 0
        );
        currentX += segmentWidth;
      }
    });
    
    // Draw others segment if needed
    if (othersCount > 0) {
      const segmentWidth = (othersCount / totalChars) * barWidth;
      if (segmentWidth > 0) {
        this.drawOthersSegment(ctx, othersCount, currentX, barY, segmentWidth, barHeight);
      }
    }
  }

  private drawCharacterSegment(
    ctx: CanvasRenderingContext2D,
    char: string,
    count: number,
    x: number,
    y: number,
    width: number,
    height: number,
    isFirst: boolean = false,
    isLast: boolean = false
  ): void {
    // Ensure we have a valid character to draw
    if (!char || char.trim() === '') return;
    // Ensure minimum width for visibility
    const actualWidth = Math.max(width, 2);
    
    // Use the same color generation as the app interface
    const fillColor = this.getCharacterFillColor(char, count);
    
    // Draw filled rectangle with the app's color scheme
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    this.roundRect(
      ctx,
      x,
      y,
      actualWidth,
      height,
      6,
      isFirst,
      isLast
    );
    ctx.fill();
    
    // Extract text color from the fill color's hue for better visibility
    const textColor = this.isDarkMode ? '#ffffff' : '#000000';
    this.drawSegmentLabel(ctx, char, count, x, y, actualWidth, height, textColor, 'transparent');
  }

  private drawOthersSegment(
    ctx: CanvasRenderingContext2D,
    count: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Save the current context state
    ctx.save();
    
    // Ensure minimum width for visibility
    const actualWidth = Math.max(width, 2);
    
    // Use the same color as the app interface for "others" segment
    const othersColor = this.isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
    
    // Draw filled rectangle
    ctx.fillStyle = othersColor;
    ctx.beginPath();
    this.roundRect(ctx, x, y, actualWidth, height, 6, false, true);
    ctx.fill();
    
    // Draw label
    const textColor = this.isDarkMode ? '#ffffff' : '#000000';
    this.drawSegmentLabel(
      ctx,
      'others',
      count,
      x,
      y,
      actualWidth,
      height,
      textColor,
      'transparent'
    );
    
    // Restore context state
    ctx.restore();
  }




}