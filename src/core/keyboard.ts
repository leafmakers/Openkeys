import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Scene } from './scene';
import type { OpenKeysConfig, ThemeColors } from './config';
import type { Emitter } from './emitter';
import type { OpenKeysEvents } from './types';

type Emit = Emitter<OpenKeysEvents>['emit'];
const noopEmit: Emit = () => {};

export class Keyboard {
  private scene: Scene;
  private config: OpenKeysConfig;
  private emit: Emit;
  private rowStagger: number;
  private keyGap: number;
  private keyMap: string[][];
  private keyObjects: Record<string, THREE.Mesh>;
  private textObjects: Record<string, THREE.Mesh>;
  private outlineObjects: Record<string, THREE.LineSegments>;
  private baseOutlineObjects: Record<string, THREE.LineSegments>;
  private keyHeights: Record<string, number>;
  private keyWaves: Record<string, { time: number; active: boolean; distance?: number }>;
  private keyTypeCounts: Record<string, number>;
  private keySize: number;
  private spacing: number;
  private growthIncrement: number;
  private waveSpeed: number;
  private waveRadius: number;
  private waveHeight: number;
  private idleAnimationTime: number;
  private clearAnimationInProgress: boolean = false;
  /** True once the (async font-dependent) keyboard mesh has been built. */
  public isBuilt: boolean = false;
  private onReadyCallback: (() => void) | null = null;
  private container: THREE.Group;
  private isDarkMode: boolean;
  private keyMaterials: Record<string, THREE.MeshPhysicalMaterial[]>;
  private textMaterials: Record<string, THREE.MeshPhysicalMaterial>;
  private loadedFonts: Record<string, any>;
  private currentFont: any;
  private fontLoader: FontLoader;
  private rotationState: {
    isRotating: boolean;
    startTime: number;
    rotationDuration: number;
    pauseDuration: number;
    initialRotation: number;
    targetRotation: number;
    isPaused: boolean;
    pauseStartTime: number;
  };
  // Animation state removed - was unused
  // private aiRemixAnimation: {
  //   isActive: boolean;
  //   startTime: number;
  //   pulseSpeed: number;
  //   waveRadius: number;
  // };

  constructor(scene: Scene, config: OpenKeysConfig, emit: Emit = noopEmit) {
    this.scene = scene;
    this.config = config;
    this.emit = emit;

    // Keyboard layout comes from config (QWERTY by default)
    this.keyMap = config.layout.rows;
    this.rowStagger = config.layout.rowStagger;
    this.keyGap = config.layout.keyGap;

    // Initialize properties
    // Key-related objects and states
    this.keyObjects = {};
    this.textObjects = {};
    this.outlineObjects = {};
    this.baseOutlineObjects = {};
    this.keyHeights = {};
    this.keyWaves = {};
    this.keyTypeCounts = {};
    this.keyMaterials = {};
    this.textMaterials = {};
    this.loadedFonts = {};
    this.currentFont = null;
    this.fontLoader = new FontLoader();

    // Keyboard dimensions and animation parameters (from config)
    this.keySize = config.layout.keySize;
    this.spacing = config.layout.spacing;
    this.growthIncrement = config.data.growthIncrement;
    this.waveSpeed = config.animation.wave.speed;
    this.waveRadius = config.animation.wave.radius;
    this.waveHeight = config.animation.wave.height;
    this.idleAnimationTime = 0;

    // State flags
    this.isDarkMode = config.theme.mode === 'dark';
    // Animation state removed - was unused

    // Setup keyboard container
    // Create a container for all keyboard elements
    this.container = new THREE.Group();
    this.scene.scene.add(this.container);
    
    // Initialize rotation animation properties
    this.rotationState = {
      isRotating: config.animation.intro.enabled,
      startTime: performance.now(),
      rotationDuration: config.animation.intro.duration,
      pauseDuration: config.animation.intro.pause,
      initialRotation: 0,
      targetRotation: Math.PI * 2, // 360 degrees
      isPaused: false,
      pauseStartTime: 0
    };

    this.loadFonts();
  }

  private theme(): ThemeColors {
    return this.isDarkMode ? this.config.theme.dark : this.config.theme.light;
  }

  createKeyMaterial() {
    const colors = this.theme();

    // Simple side material without complex textures
    const sideMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colors.keySide),
      transparent: true,
      opacity: 0.8
    });

    // Top material - physical material for light mode, basic for dark mode
    const topMaterial = this.isDarkMode
      ? new THREE.MeshBasicMaterial({
          color: new THREE.Color(colors.keyTop),
          transparent: false
        })
      : new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(colors.keyTop),
          metalness: 0.1,
          roughness: 0.2,
          clearcoat: 0.8,
          clearcoatRoughness: 0.1,
          emissive: new THREE.Color(colors.keyTop),
          emissiveIntensity: 0.3,
          transparent: false
        });

    return [
      sideMaterial, sideMaterial, topMaterial,
      sideMaterial, sideMaterial, sideMaterial
    ];
  }

  loadFonts() {
    // Key-cap typefaces come from config (three.js typeface.json)
    const fonts = this.config.typography.keyCapFonts;
    const defaultName = this.config.typography.defaultFont;

    let fontsLoaded = 0;
    const totalFonts = fonts.length;

    fonts.forEach(({ name: fontName, url }) => {
      this.fontLoader.load(url, (font) => {
        this.loadedFonts[fontName] = font;
        fontsLoaded++;

        // Use the configured default font
        if (fontName === defaultName) {
          this.currentFont = font;
        }

        // Create keyboard when all fonts are loaded
        if (fontsLoaded === totalFonts) {
          // Fall back to the first loaded font if the default name didn't match
          if (!this.currentFont) {
            this.currentFont = this.loadedFonts[fonts[0].name];
          }
          this.createKeyboard();
        }
      });
    });
  }

  createKeyboard() {
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: 3,
      transparent: true,
      opacity: 0.60
    });

    this.keyMap.forEach((row, rowIndex) => {
      const z = rowIndex * this.spacing;
      let x = rowIndex * this.rowStagger;

      row.forEach((key) => {
        this.createKeyWithOutlineAndText(key, x, z, this.currentFont, outlineMaterial);
        x += this.keySize + this.keyGap;
      });
    });

    this.isBuilt = true;
    this.onReadyCallback?.();
  }

  /** Register a callback to run once the keyboard mesh is built (fires immediately if already built). */
  setOnReady(cb: () => void) {
    this.onReadyCallback = cb;
    if (this.isBuilt) cb();
  }

  createKeyWithOutlineAndText(key: string, x: number, z: number, font: any, outlineMaterial: THREE.LineBasicMaterial) {
    // Create main key mesh
    const geometry = new THREE.BoxGeometry(this.keySize, this.keySize, this.keySize);
    const keyMaterials = this.createKeyMaterial();
    const mesh = new THREE.Mesh(geometry, keyMaterials);
    this.setupKeyMesh(mesh, x, z);
    
    // Create key outline
    const outline = this.createKeyOutline(mesh.position, outlineMaterial);
    
    // Create base outline
    const baseOutline = this.createBaseOutline(mesh.position);
    
    // Create text material for this key
    const textMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.theme().keyText),
      metalness: 0,
      roughness: 1
    });
    
    // Create key text
    const textMesh = this.createKeyText(key, font, textMaterial);
    mesh.add(textMesh);
    
    // Store references
    this.keyObjects[key] = mesh;
    this.keyMaterials[key] = keyMaterials as THREE.MeshPhysicalMaterial[];
    this.textMaterials[key] = textMaterial;
    this.outlineObjects[key] = outline;
    this.baseOutlineObjects[key] = baseOutline;
    this.textObjects[key] = textMesh;
    this.keyHeights[key] = 0;
    this.keyWaves[key] = { time: 0, active: false };
    this.keyTypeCounts[key] = 0;
  }

  setupKeyMesh(mesh: THREE.Mesh, x: number, z: number) {
    mesh.position.set(x + this.keySize/2 - 50, 0, z - 20);
    mesh.scale.y = 0.01;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.container.add(mesh);
  }

  createKeyOutline(position: THREE.Vector3, _material: THREE.LineBasicMaterial) {
    const outlineGeometry = new THREE.BoxGeometry(
      this.keySize + 0.1,
      this.keySize + 0.1,
      this.keySize + 0.1
    );
    const edges = new THREE.EdgesGeometry(outlineGeometry);
    const colors = this.theme();

    // Create material that responds to dark mode
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(colors.outline),
      linewidth: 3,
      transparent: true,
      opacity: colors.outlineOpacity
    });

    const outline = new THREE.LineSegments(edges, outlineMaterial);
    outline.position.copy(position);
    outline.scale.y = 0.01;
    outline.castShadow = true;
    this.container.add(outline);
    return outline;
  }

  createBaseOutline(position: THREE.Vector3) {
    // Create a square outline at the base of the key
    const baseGeometry = new THREE.PlaneGeometry(this.keySize, this.keySize);
    const edges = new THREE.EdgesGeometry(baseGeometry);
    const colors = this.theme();

    // Create material that responds to dark mode
    const baseOutlineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(colors.baseOutline),
      linewidth: 2,
      transparent: true,
      opacity: colors.baseOutlineOpacity
    });
    
    const baseOutline = new THREE.LineSegments(edges, baseOutlineMaterial);
    baseOutline.position.copy(position);
    baseOutline.position.y = 0.1; // Slightly above the floor
    baseOutline.rotation.x = -Math.PI / 2; // Lay flat on the ground
    this.container.add(baseOutline);
    return baseOutline;
  }

  createKeyText(key: string, font: any, material: THREE.MeshPhysicalMaterial) {
    const textGeometry = new TextGeometry(key, {
      font: font,
      size: this.config.typography.textSize,
      height: 0,
      curveSegments: this.config.typography.curveSegments,
    });
    textGeometry.computeBoundingBox();
    const textMesh = new THREE.Mesh(textGeometry, material);
    
    const textWidth = textGeometry.boundingBox!.max.x - textGeometry.boundingBox!.min.x;
    textMesh.position.set(
      -textWidth/2,
      this.keySize/2 + 0.1,
      -1.5
    );
    textMesh.rotation.x = -Math.PI / 2;
    return textMesh;
  }

  updateKeyObject(key: string, targetHeight: number | null = null) {
    const mesh = this.keyObjects[key];
    const outline = this.outlineObjects[key];
    
    // CRITICAL: Height must ALWAYS match character count - never override this relationship
    const height = this.keyHeights[key] || 0.01;
    
    // Only allow temporary height override for animations (like key press effects)
    const displayHeight = targetHeight !== null ? targetHeight : height;
    
    mesh.scale.y = Math.max(0.01, displayHeight);
    mesh.position.y = (this.keySize * displayHeight) / 2;
    outline.scale.y = displayHeight;
    outline.position.y = mesh.position.y;

    (mesh.material as THREE.Material[]).forEach((material: any) => {
      if (material.emissive) {
        material.emissiveIntensity = displayHeight > 0.01 ? 0.2 : 0;
      }
    });
    
    // Validate that stored height matches character count (except during temporary animations)
    if (targetHeight === null) {
      const expectedHeight = this.growthIncrement * (this.keyTypeCounts[key] || 0);
      if (Math.abs(this.keyHeights[key] - expectedHeight) > 0.001) {
        console.warn(`Height mismatch for key ${key}: stored=${this.keyHeights[key]}, expected=${expectedHeight}`);
        // Force correction
        this.keyHeights[key] = expectedHeight;
      }
    }
  }

  createWaveEffect(sourceKey: string) {
    const sourcePos = this.keyObjects[sourceKey].position.clone();
    Object.entries(this.keyObjects).forEach(([key, mesh]) => {
      const distance = sourcePos.distanceTo(mesh.position);
      if (distance <= this.waveRadius && key !== sourceKey) {
        this.keyWaves[key] = {
          time: 0,
          active: true,
          distance: distance
        };
      }
    });
  }

  updateWaves() {
    Object.entries(this.keyWaves).forEach(([key, wave]) => {
      if (wave.active) {
        wave.time += this.waveSpeed;
        const mesh = this.keyObjects[key];
        const outline = this.outlineObjects[key];
        
        if (wave.time >= Math.PI) {
          this.resetWave(key, wave, mesh, outline);
        } else {
          this.updateWavePosition(key, wave, mesh, outline);
        }
      }
    });
  }

  resetWave(key: string, wave: any, mesh: THREE.Mesh, outline: THREE.LineSegments) {
    wave.active = false;
    wave.time = 0;
    mesh.position.y = (this.keySize * this.keyHeights[key]) / 2;
    outline.position.y = mesh.position.y;
  }

  updateWavePosition(key: string, wave: any, mesh: THREE.Mesh, outline: THREE.LineSegments) {
    const waveOffset = Math.sin(wave.time) * this.waveHeight * 
      (1 - wave.distance / this.waveRadius);
    mesh.position.y = (this.keySize * this.keyHeights[key]) / 2 + waveOffset;
    outline.position.y = mesh.position.y;
  }

  updateIdleAnimation() {
    const idle = this.config.animation.idle;
    this.idleAnimationTime += idle.speed;

    Object.entries(this.keyObjects).forEach(([key, mesh]) => {
      // CRITICAL: Base height must always match character count
      const baseHeight = this.growthIncrement * (this.keyTypeCounts[key] || 0);
      this.keyHeights[key] = baseHeight; // Ensure stored height is always correct

      const offset = idle.enabled
        ? Math.sin(this.idleAnimationTime + mesh.position.x * 0.1) * idle.amplitude
        : 0;
      const animatedHeight = Math.max(0.01, baseHeight + offset);
      
      mesh.scale.y = animatedHeight;
      mesh.position.y = (this.keySize * animatedHeight) / 2;
      
      const outline = this.outlineObjects[key];
      outline.scale.y = animatedHeight;
      outline.position.y = mesh.position.y;
    });
  }

  updateFromText(text: string) {
    this.resetAllKeys();
    
    if (!text || text === "type something…") {
      return;
    }

    // Always process text input for automatic key growth
    this.processTextInput(text);
  }

  resetAllKeys() {
    // CRITICAL: Reset both counts and heights to maintain relationship
    Object.keys(this.keyHeights).forEach(key => {
      this.keyTypeCounts[key] = 0;
      this.keyHeights[key] = this.growthIncrement * this.keyTypeCounts[key]; // Should be 0
      this.updateKeyObject(key);
    });
  }

  private computeCounts(text: string): Record<string, number> {
    const counts: Record<string, number> = {};
    const src = this.config.data.caseSensitive ? text : text.toLowerCase();
    src.split('').forEach(char => {
      if (this.keyObjects[char]) {
        counts[char] = (counts[char] || 0) + 1;
      }
    });
    return counts;
  }

  /** Resolve the value (key height multiplier) for a label per the configured data mode. */
  private computeValue(label: string, text: string, counts: Record<string, number>): number {
    const d = this.config.data;
    if (d.mode === 'static') return d.staticValues?.[label] ?? 0;
    if (d.mode === 'custom' && d.valueFn) return d.valueFn(label, text, counts);
    return counts[label] || 0; // 'frequency'
  }

  processTextInput(text: string) {
    const counts = this.computeCounts(text);

    Object.keys(this.keyObjects).forEach(char => {
      // CRITICAL: value determines height - this relationship is immutable
      const value = this.computeValue(char, text, counts);
      this.keyTypeCounts[char] = value;
      this.keyHeights[char] = this.growthIncrement * value;
      this.updateKeyObject(char);
      if (value > 0) {
        this.createWaveEffect(char);
      }
    });
  }

  /** Whether a given label has a key in the current layout. */
  hasKey(label: string): boolean {
    return !!this.keyObjects[label];
  }

  /** Read-only snapshot of the current per-key values, for the `data` event. */
  snapshot(): { counts: Record<string, number>; heights: Record<string, number> } {
    return { counts: { ...this.keyTypeCounts }, heights: { ...this.keyHeights } };
  }

  async animateKeyDown(key: string, startHeight: number) {
    return new Promise<void>(resolve => {
      const steps = 60;
      // const duration = 1000; // Fixed duration for smooth animation - unused
      let currentStep = 0;
      
      const animate = () => {
        if (currentStep >= steps) {
          this.updateKeyObject(key, 0);
          this.createWaveEffect(key);
          resolve();
          return;
        }
        
        const progress = currentStep / (steps - 1);
        const easeProgress = 1 - Math.pow(1 - progress, 2);
        const height = startHeight * (1 - easeProgress);
        this.updateKeyObject(key, height);
        
        currentStep++;
        requestAnimationFrame(animate);
      };
      
      animate();
    });
  }

  async clear(currentText: string = '') {
    if (this.clearAnimationInProgress) return;
    this.clearAnimationInProgress = true;

    if (currentText && currentText.trim()) {
      await this.animateBackspaceSequence(currentText);
    } else {
      // If no text, just clear all keys normally
      await this.clearAllKeysInstantly();
    }

    this.clearAnimationInProgress = false;
  }

  /** Emit the current display text + per-key data during an animation step. */
  private emitProgress(text: string) {
    const { counts, heights } = this.snapshot();
    this.emit('textchange', {
      text,
      length: text.length,
      max: this.config.features.maxCharacters,
      source: 'program',
    });
    this.emit('data', { text, counts, heights, mode: this.config.data.mode });
  }

  async animateTypingSequence(newText: string) {
    const chars = newText.toLowerCase().split('');
    const initialDelay = 50;  // Start slower (3x faster)
    const finalDelay = 10;    // End faster (3x faster)
    
    // Reset all keys to zero before starting
    this.resetAllKeys();

    // Clear current text display first
    this.emitProgress('');

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const currentText = newText.substring(0, i + 1);
      
      // Calculate accelerating delay - starts slow, gets faster
      const progress = i / (chars.length - 1);
      const currentDelay = initialDelay - (initialDelay - finalDelay) * Math.pow(progress, 2);
      
      // Animate key press if it exists
      if (this.keyObjects[char]) {
        await this.animateKeyPress(char);
        
        // CRITICAL: Increment count and recalculate height based on count
        this.keyTypeCounts[char] = (this.keyTypeCounts[char] || 0) + 1;
        this.keyHeights[char] = this.growthIncrement * this.keyTypeCounts[char];
        this.updateKeyObject(char);
      }
      
      // Emit the in-progress text + data for any view modules
      this.emitProgress(currentText);

      // Wait before next key press
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }

  async animateBackspaceSequence(text: string) {
    const chars = text.toLowerCase().split('').reverse(); // Reverse for backspace order
    const initialDelay = 20;  // Start slower (3x faster)
    const finalDelay = 3;     // End faster (3x faster)
    
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      
      // Calculate accelerating delay - starts slow, gets faster
      const progress = i / (chars.length - 1);
      const currentDelay = initialDelay - (initialDelay - finalDelay) * Math.pow(progress, 2);
      
      if (this.keyObjects[char]) {
        // Animate key press (down and up)
        await this.animateKeyPress(char);

        // CRITICAL: Decrement count and recalculate height based on count
        if (this.keyTypeCounts[char] > 0) {
          this.keyTypeCounts[char]--;
          this.keyHeights[char] = this.growthIncrement * this.keyTypeCounts[char];
          this.updateKeyObject(char);
        }

        // Emit the shrinking text + data to update view modules
        this.emitProgress(text.substring(0, chars.length - i - 1));
      }

      // Wait before next key press
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }

    // Final cleanup - ensure all keys are reset
    await this.clearAllKeysInstantly();

    // Reset view to empty after backspace completes
    this.emitProgress('');
  }

  private async animateKeyPress(key: string) {
    const mesh = this.keyObjects[key];
    const outline = this.outlineObjects[key];
    if (!mesh || !outline) return;

    const originalHeight = this.keyHeights[key] || 0.01;
    const pressDepth = this.config.animation.keyPressDepth; // How far down the key goes when pressed
    const totalDuration = 100; // Total animation time in ms
    const startTime = performance.now();

    return new Promise<void>(resolve => {
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / totalDuration, 1);
        
        // Create a press-release cycle: down for first half, up for second half
        let heightOffset;
        if (progress < 0.5) {
          // Press down (first half)
          const pressProgress = progress * 2;
          heightOffset = -pressDepth * Math.sin(pressProgress * Math.PI / 2);
        } else {
          // Release up (second half) 
          const releaseProgress = (progress - 0.5) * 2;
          heightOffset = -pressDepth * Math.cos(releaseProgress * Math.PI / 2);
        }
        
        const currentHeight = originalHeight + heightOffset;
        this.updateKeyObject(key, Math.max(0.01, currentHeight));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure key returns to original height
          this.updateKeyObject(key, originalHeight);
          this.createWaveEffect(key);
          resolve();
        }
      };
      
      requestAnimationFrame(animate);
    });
  }

  private async clearAllKeysInstantly() {
    // CRITICAL: Reset both counts and heights to maintain relationship
    Object.keys(this.keyHeights).forEach(key => {
      this.keyTypeCounts[key] = 0;
      this.keyHeights[key] = this.growthIncrement * this.keyTypeCounts[key]; // Should be 0
      this.updateKeyObject(key);
    });
  }

  increaseHeight() {
    // Implementation removed - unused
  }

  decreaseHeight() {
    // Implementation removed - unused
  }

  updateRotation() {
    if (!this.rotationState.isRotating) return;

    const currentTime = performance.now();
    const elapsed = currentTime - this.rotationState.startTime;
    
    if (elapsed >= this.rotationState.rotationDuration) {
      // Complete the rotation and stop
      this.container.rotation.y = this.rotationState.targetRotation;
      this.rotationState.isRotating = false;
      return;
    }

    const progress = elapsed / this.rotationState.rotationDuration;
    const easedProgress = 1 - Math.cos(progress * Math.PI / 2); // Smooth easing
    const newRotation = this.rotationState.initialRotation + 
      (this.rotationState.targetRotation - this.rotationState.initialRotation) * easedProgress;
    
    this.container.rotation.y = newRotation;
  }

  update() {
    this.updateWaves();
    this.updateIdleAnimation();
    this.updateRotation();
  }

  startAiRemixAnimation() {
    // AI Remix now uses typing animation instead of ripple effects
    // This method is kept for compatibility but doesn't start ripple animation
  }

  stopAiRemixAnimation() {
    // AI Remix typing animation handles its own completion
    // This method is kept for compatibility
  }

  // Method removed - was unused

  // Method removed - was unused

  updateTheme(isDarkMode: boolean) {
    this.isDarkMode = isDarkMode;
    const colors = this.theme();

    // Update key materials (key caps)
    Object.entries(this.keyMaterials).forEach(([key, materials]) => {
      // Update the top material (key cap) - index 2
      // Need to recreate the material since we're switching between Basic and Physical
      const mesh = this.keyObjects[key];
      if (mesh) {
        const newTopMaterial = isDarkMode
          ? new THREE.MeshBasicMaterial({
              color: new THREE.Color(colors.keyTop), // Dark mode key caps
              transparent: false
            })
          : new THREE.MeshPhysicalMaterial({
              color: new THREE.Color(colors.keyTop),
              metalness: 0.1,
              roughness: 0.2,
              clearcoat: 0.8,
              clearcoatRoughness: 0.1,
              emissive: new THREE.Color(colors.keyTop),
              emissiveIntensity: 0.3,
              transparent: false
            });

        // Update the material array
        (materials as any)[2] = newTopMaterial;

        // Update the mesh materials
        if (Array.isArray(mesh.material)) {
          mesh.material[2] = newTopMaterial;
        }
      }

      // Update side materials - indices 0, 1, 3, 4, 5
      [0, 1, 3, 4, 5].forEach(index => {
        const sideMaterial = materials[index] as unknown as THREE.MeshBasicMaterial;
        if (sideMaterial) {
          sideMaterial.color.set(colors.keySide);
        }
      });
    });

    // Update text materials
    Object.values(this.textMaterials).forEach(textMaterial => {
      textMaterial.color.set(colors.keyText);
    });

    // Update all existing outlines
    Object.values(this.outlineObjects).forEach(outline => {
      if (outline.material) {
        (outline.material as any).color.set(colors.outline);
        (outline.material as any).opacity = colors.outlineOpacity;
      }
    });

    // Update all existing base outlines
    Object.values(this.baseOutlineObjects).forEach(baseOutline => {
      if (baseOutline.material) {
        (baseOutline.material as any).color.set(colors.baseOutline);
        (baseOutline.material as any).opacity = colors.baseOutlineOpacity;
      }
    });
  }

  updateKeyCapFont(_fontFamily: string, fontName: string) {
    // Map font to closest available Three.js font or use System as fallback
    let targetFont = this.loadedFonts[fontName];
    
    if (!targetFont) {
      // Try to map to a similar loaded font based on characteristics
      if (fontName.toLowerCase().includes('serif') || fontName.toLowerCase().includes('display') || fontName.toLowerCase().includes('playfair')) {
        targetFont = this.loadedFonts['Georgia'];
      } else if (fontName.toLowerCase().includes('condensed') || fontName.toLowerCase().includes('narrow')) {
        targetFont = this.loadedFonts['Roboto Condensed'];
      } else if (fontName.toLowerCase().includes('inter') || fontName.toLowerCase().includes('grotesk') || fontName.toLowerCase().includes('sans')) {
        targetFont = this.loadedFonts['Inter'];
      } else {
        targetFont = this.loadedFonts['System'];
      }
      
      if (!targetFont) {
        console.warn(`Font ${fontName} not loaded and no fallback available`);
        return;
      }
      
      console.log(`Font ${fontName} not available in 3D, using fallback`);
    }

    // Update current font
    this.currentFont = targetFont;

    // Recreate all text objects with new font
    Object.entries(this.textObjects).forEach(([key, textMesh]) => {
      const keyMesh = this.keyObjects[key];
      if (!keyMesh) return;

      // Remove old text mesh
      keyMesh.remove(textMesh);
      textMesh.geometry.dispose();
      
      // Create new text material
      const textMaterial = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(this.theme().keyText),
        metalness: 0,
        roughness: 1
      });

      // Create new text mesh with current font
      const newTextMesh = this.createKeyText(key, this.currentFont, textMaterial);
      
      // Apply font-specific styling
      this.applyFontStyling(newTextMesh, fontName);
      
      // Add to key mesh
      keyMesh.add(newTextMesh);
      
      // Update references
      this.textObjects[key] = newTextMesh;
      this.textMaterials[key] = textMaterial;
    });
  }

  private applyFontStyling(textMesh: THREE.Mesh, fontName: string) {
    const textMaterial = textMesh.material as THREE.MeshPhysicalMaterial;
    
    switch (fontName) {
      case 'Georgia':
        // Serif fonts - elegant and refined
        textMaterial.roughness = 0.8;
        textMaterial.metalness = 0.05;
        textMesh.scale.set(0.95, 0.95, 1);
        break;
        
      case 'Roboto Condensed':
        // Condensed font - narrower and taller
        textMaterial.roughness = 0.9;
        textMaterial.metalness = 0;
        textMesh.scale.set(0.85, 1.1, 1);
        break;
        
      case 'Inter':
        // Modern sans-serif - clean and sharp
        textMaterial.roughness = 1.0;
        textMaterial.metalness = 0;
        textMesh.scale.set(1, 1, 1);
        break;
        
      default: // 'System'
        // Default balanced styling
        textMaterial.roughness = 1.0;
        textMaterial.metalness = 0;
        textMesh.scale.set(1, 1, 1);
        break;
    }
    
    textMaterial.needsUpdate = true;
  }
}