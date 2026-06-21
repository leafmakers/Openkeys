import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type { OpenKeysConfig, Vec3, OrbitControlsConfig } from './config';

/** Darkness of key shadows on the floor's transparent shadow catcher (0–1). */
const FLOOR_SHADOW_OPACITY = 0.18;
/**
 * Contact-safe directional-shadow tuning. The previous radius of 24 spread the
 * PCF kernel far enough to erase the contact edge, while a 0.01 normal bias pushed
 * the first visible samples away from the key base (classic peter-panning).
 */
const KEY_SHADOW_RADIUS = 3;
const KEY_SHADOW_BIAS = -0.00015;
const KEY_SHADOW_NORMAL_BIAS = 0.002;

export class Scene {
  public scene!: THREE.Scene;
  public renderer!: THREE.WebGLRenderer;
  public camera!: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  public controls!: OrbitControls;
  private config: OpenKeysConfig;
  /** Element the renderer canvas is appended to (defaults to document.body). */
  private container: HTMLElement;
  private ambientLight!: THREE.AmbientLight;
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private backLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private floor!: THREE.Mesh;
  private floorMaterial!: THREE.ShadowMaterial;
  private isDarkMode: boolean;

  constructor(config: OpenKeysConfig, container: HTMLElement = document.body) {
    this.config = config;
    this.container = container;
    this.isDarkMode = config.theme.mode === 'dark';
    this.initializeScene();
    this.setupRenderer();
    this.setupCamera();
    this.setupLights();
    this.setupControls();
    this.setupFloor();
    this.loadEnvironment();
    this.animate = this.animate.bind(this);
  }

  private theme() {
    return this.isDarkMode ? this.config.theme.dark : this.config.theme.light;
  }

  initializeScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.sceneBackgroundColor());
  }

  /**
   * Color for the WebGL clear. When the floor is enabled we match it to the floor
   * color so the ground reads as infinite. An orthographic camera tilted over a
   * flat plane always leaves part of the viewport *below* the plane — worse the
   * more you zoom out or the taller the viewport — and the floor's finite size
   * can't cover it (the gap is below the plane, not past its edge). A mismatched
   * background would show through there as a hard-edged void; matching hides it.
   */
  private sceneBackgroundColor(): string {
    const colors = this.theme();
    return this.config.scene.floor.enabled ? colors.floor : colors.background;
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.config.scene.antialias,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.config.scene.preserveDrawingBuffer,
    });

    this.configureRenderer();
    this.setupRendererSize();
    this.container.appendChild(this.renderer.domElement);
  }

  configureRenderer() {
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    (this.renderer as any).physicallyCorrectLights = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.config.scene.toneMappingExposure;
    (this.renderer as any).outputEncoding = (THREE as any).sRGBEncoding;
  }

  private viewportWidth() {
    return this.container === document.body ? window.innerWidth : this.container.clientWidth;
  }

  private viewportHeight() {
    return this.container === document.body ? window.innerHeight : this.container.clientHeight;
  }

  private isMobile() {
    return this.viewportWidth() <= this.config.scene.mobileBreakpoint;
  }

  setupRendererSize() {
    this.renderer.setSize(this.viewportWidth(), this.viewportHeight());
    // Supersample: render at >=2x device pixels (up to the cap), even on 1x displays.
    // MSAA only anti-aliases coverage; the thin 1px outlines, glyph edges and sharp
    // clearcoat speculars alias in SHADING and crawl under motion. Extra shaded
    // samples (SSAA) are the one fix that catches all three. Capped so retina (already
    // >=2x) is unaffected and perf stays bounded.
    const ss = Math.max(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(Math.min(ss, this.config.scene.pixelRatioCap));
  }

  getInitialFrustumSize() {
    const f = this.config.camera.frustum;
    return this.isMobile() ? f.mobile : f.desktop;
  }

  setupCamera() {
    const aspect = this.viewportWidth() / this.viewportHeight();
    this.camera = this.createCamera(aspect);
    this.applyCameraPlacement();
  }

  /** Build the camera for the configured projection (orthographic | perspective). */
  private createCamera(aspect: number): THREE.OrthographicCamera | THREE.PerspectiveCamera {
    const { projection, near, far, fov } = this.config.camera;
    if (projection === 'perspective') {
      return new THREE.PerspectiveCamera(fov, aspect, near, far);
    }
    const d = this.getInitialFrustumSize();
    return new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, near, far);
  }

  private applyCameraPlacement() {
    const cam = this.config.camera;
    const pos: Vec3 = this.isMobile() ? cam.position.mobile : cam.position.desktop;
    const look: Vec3 = this.isMobile() ? cam.lookAt.mobile : cam.lookAt.desktop;
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.camera.lookAt(look[0], look[1], look[2]);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.configureControls();
  }

  configureControls() {
    const c = this.config.camera.controls;
    this.controls.target.set(c.target[0], c.target[1], c.target[2]);
    this.applyControlsConfig();
  }

  /** Push every OrbitControls tuning value from config onto the live controls. */
  applyControlsConfig() {
    const c = this.config.camera.controls;
    this.controls.enableRotate = c.enableRotate;
    this.controls.enableZoom = c.enableZoom;
    this.controls.enablePan = c.enablePan;
    this.controls.enableDamping = c.enableDamping;
    this.controls.dampingFactor = c.dampingFactor;
    this.controls.rotateSpeed = c.rotateSpeed;
    this.controls.zoomSpeed = c.zoomSpeed;
    this.controls.minPolarAngle = c.minPolarAngle;
    this.controls.maxPolarAngle = c.maxPolarAngle;
    this.controls.minAzimuthAngle = c.minAzimuthAngle;
    this.controls.maxAzimuthAngle = c.maxAzimuthAngle;
    this.controls.minZoom = c.minZoom;
    this.controls.maxZoom = c.maxZoom;
    // Perspective dolly fence (OrbitControls ignores these for an ortho camera, which
    // uses min/maxZoom instead). Bounds the camera→target distance so zoom can't push
    // the board past the near/far planes. Guard against undefined for configs predating
    // these fields.
    this.controls.minDistance = c.minDistance ?? 0;
    this.controls.maxDistance = c.maxDistance ?? Infinity;
    this.controls.autoRotate = c.autoRotate;
    this.controls.autoRotateSpeed = c.autoRotateSpeed;
    this.controls.update();
  }

  /** Merge a partial controls config and re-apply it live. */
  setControls(partial: Partial<OrbitControlsConfig>) {
    Object.assign(this.config.camera.controls, partial);
    this.applyControlsConfig();
  }

  /** Current camera orbit angles relative to the target (radians). */
  getOrbit(): { azimuth: number; polar: number } {
    return { azimuth: this.controls.getAzimuthalAngle(), polar: this.controls.getPolarAngle() };
  }

  /**
   * Orbit the camera to a given azimuth/polar (radians) about the current target,
   * preserving the eye distance. Polar is clamped to the controls' configured
   * limits. Used by the view-cube gizmo to drive the keyboard from the UI.
   */
  orbitTo(azimuth: number, polar: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    sph.theta = azimuth;
    sph.phi = THREE.MathUtils.clamp(polar, this.controls.minPolarAngle, this.controls.maxPolarAngle);
    sph.makeSafe();
    offset.setFromSpherical(sph);
    this.camera.position.copy(this.controls.target).add(offset);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  /** Snap the camera back to its configured placement, zoom and target. */
  resetView() {
    this.applyCameraPlacement();
    const c = this.config.camera.controls;
    this.controls.target.set(c.target[0], c.target[1], c.target[2]);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /**
   * Live-swap the projection (orthographic ⇆ perspective). Rebuilds the camera and
   * its OrbitControls, preserving the current eye position and orbit target so the
   * view doesn't jump. The render loop reads `scene.camera`/`scene.controls` each
   * frame, so the swap takes effect immediately.
   */
  setProjection(projection: 'orthographic' | 'perspective') {
    if (projection === this.config.camera.projection) return;
    this.config.camera.projection = projection;
    const aspect = this.viewportWidth() / this.viewportHeight();
    const pos = this.camera.position.clone();
    const target = this.controls.target.clone();

    this.camera = this.createCamera(aspect);
    this.camera.position.copy(pos);
    this.camera.lookAt(target);

    this.controls.dispose();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(target);
    this.applyControlsConfig();
  }

  /** Live-set the perspective field of view (degrees). No-op for orthographic. */
  setFov(fov: number) {
    this.config.camera.fov = fov;
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  setupLights() {
    this.setupAmbientLight();
    this.setupKeyLight();
    this.setupFillLight();
    this.setupBackLight();
    this.setupRimLight();
  }

  setupAmbientLight() {
    const a = this.config.lights.ambient;
    this.ambientLight = new THREE.AmbientLight(new THREE.Color(a.color), a.intensity);
    this.scene.add(this.ambientLight);
  }

  setupKeyLight() {
    const k = this.config.lights.key;
    this.keyLight = new THREE.DirectionalLight(new THREE.Color(k.color), k.intensity);
    this.keyLight.position.set(k.position[0], k.position[1], k.position[2]);
    this.configureKeyLightShadow();
    this.scene.add(this.keyLight);
  }

  configureKeyLightShadow() {
    const size = this.config.lights.shadowMapSize;
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = size;
    this.keyLight.shadow.mapSize.height = size;
    this.keyLight.shadow.camera.near = 0.1;
    this.keyLight.shadow.camera.far = 500;
    this.keyLight.shadow.camera.left = -100;
    this.keyLight.shadow.camera.right = 100;
    this.keyLight.shadow.camera.top = 100;
    this.keyLight.shadow.camera.bottom = -100;
    this.keyLight.shadow.radius = KEY_SHADOW_RADIUS;
    this.keyLight.shadow.bias = KEY_SHADOW_BIAS;
    this.keyLight.shadow.normalBias = KEY_SHADOW_NORMAL_BIAS;
    this.keyLight.shadow.camera.updateProjectionMatrix();
  }

  setupFillLight() {
    const l = this.config.lights.fill;
    this.fillLight = new THREE.DirectionalLight(new THREE.Color(l.color), l.intensity);
    this.fillLight.position.set(l.position[0], l.position[1], l.position[2]);
    this.fillLight.castShadow = false;
    this.scene.add(this.fillLight);
  }

  setupBackLight() {
    const l = this.config.lights.back;
    this.backLight = new THREE.DirectionalLight(new THREE.Color(l.color), l.intensity);
    this.backLight.position.set(l.position[0], l.position[1], l.position[2]);
    this.backLight.castShadow = false;
    this.scene.add(this.backLight);
  }

  setupRimLight() {
    const l = this.config.lights.rim;
    this.rimLight = new THREE.DirectionalLight(new THREE.Color(l.color), l.intensity);
    this.rimLight.position.set(l.position[0], l.position[1], l.position[2]);
    this.rimLight.castShadow = false;
    this.scene.add(this.rimLight);
  }

  updateLightPosition(angle: number) {
    const { radius, height } = this.config.lights.keyOrbit;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    this.keyLight.position.set(x, height, z);
  }

  setupFloor() {
    if (!this.config.scene.floor.enabled) return;

    const size = this.config.scene.floor.size;
    const floorGeometry = new THREE.PlaneGeometry(size, size);

    // The floor is a pure shadow catcher — it carries NO color of its own. The
    // ground color is painted by the scene background (see sceneBackgroundColor),
    // so the visible ground is identical on the plane, past its edge, AND below it.
    // This is the fix for the "plane opening up" seam: a tilted orthographic camera
    // always frames some area off the plane (more so when zoomed out / on tall
    // viewports), and any *colored* floor — even one whose hex matches the
    // background — renders through lighting + tone mapping at a different value than
    // the raw background clear color, leaving a visible edge. A transparent
    // ShadowMaterial sidesteps that entirely: it only darkens where keys cast
    // shadows and is otherwise the background.
    this.floorMaterial = new THREE.ShadowMaterial({
      transparent: true,
      opacity: FLOOR_SHADOW_OPACITY,
    });

    this.floor = new THREE.Mesh(floorGeometry, this.floorMaterial);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
  }

  updateFloorTheme(isDarkMode: boolean) {
    this.isDarkMode = isDarkMode;
    // The floor is a colorless shadow catcher; the ground color lives on the scene
    // background, so re-theming just means repainting the backdrop.
    this.scene.background = new THREE.Color(this.sceneBackgroundColor());
  }

  loadEnvironment() {
    const env = this.config.scene.environment;
    if (!env.enabled || !env.url) return;
    new RGBELoader().load(env.url, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = texture;
    });
  }

  handleResize() {
    const aspect = this.viewportWidth() / this.viewportHeight();
    this.updateCameraForViewport(aspect);
    this.updateRendererSize();
    this.applyCameraPlacement();
  }

  /** Re-fit the active camera to the viewport aspect (frustum for ortho, aspect for perspective). */
  updateCameraForViewport(aspect: number) {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = aspect;
    } else {
      const d = this.getInitialFrustumSize();
      this.camera.left = -d * aspect;
      this.camera.right = d * aspect;
      this.camera.top = d;
      this.camera.bottom = -d;
    }
    this.camera.updateProjectionMatrix();
  }

  updateRendererSize() {
    this.renderer.setSize(this.viewportWidth(), this.viewportHeight());
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.render();
  }

  generateImage() {
    this.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    this.renderer.dispose();
    this.controls.dispose();
    const el = this.renderer.domElement;
    el.parentNode?.removeChild(el);
  }
}
