import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type { OpenKeysConfig, Vec3 } from './config';

export class Scene {
  public scene!: THREE.Scene;
  public renderer!: THREE.WebGLRenderer;
  public camera!: THREE.OrthographicCamera;
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
  private floorMaterial!: THREE.MeshLambertMaterial;
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
    this.scene.background = new THREE.Color(this.theme().background);
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.config.scene.pixelRatioCap));
  }

  getInitialFrustumSize() {
    const f = this.config.camera.frustum;
    return this.isMobile() ? f.mobile : f.desktop;
  }

  setupCamera() {
    const aspect = this.viewportWidth() / this.viewportHeight();
    const d = this.getInitialFrustumSize();

    this.camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect,
      d, -d,
      this.config.camera.near, this.config.camera.far
    );

    this.applyCameraPlacement();
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
    this.controls.enableDamping = true;
    this.controls.dampingFactor = c.dampingFactor;
    this.controls.maxPolarAngle = c.maxPolarAngle;
    this.controls.minPolarAngle = c.minPolarAngle;
    this.controls.enableZoom = true;
    this.controls.minZoom = c.minZoom;
    this.controls.maxZoom = c.maxZoom;
    this.controls.enablePan = c.enablePan;
    this.controls.enableRotate = true;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
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
    this.keyLight.shadow.radius = 24;
    this.keyLight.shadow.bias = -0.0002;
    this.keyLight.shadow.normalBias = 0.01;
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

    // Create halftone shadow texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Theme-derived halftone pattern for shadows
    const light = this.config.theme.light;
    const dark = this.config.theme.dark;
    ctx.fillStyle = this.isDarkMode ? dark.keyTop : light.floor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const dotSize = 0.8;
    const spacing = 8;
    ctx.fillStyle = this.isDarkMode ? dark.keyText : light.keyText;

    if (this.config.scene.floor.halftone) {
      for (let x = 0; x < canvas.width; x += spacing) {
        for (let y = 0; y < canvas.height; y += spacing) {
          const offsetX = (y / spacing) % 2 === 0 ? 0 : spacing / 2;
          ctx.beginPath();
          ctx.arc(x + offsetX, y, dotSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const shadowTexture = new THREE.CanvasTexture(canvas);
    shadowTexture.wrapS = THREE.RepeatWrapping;
    shadowTexture.wrapT = THREE.RepeatWrapping;
    shadowTexture.repeat.set(8, 8);

    this.floorMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color(this.theme().floor),
      transparent: false,
      side: THREE.DoubleSide,
    });

    this.floor = new THREE.Mesh(floorGeometry, this.floorMaterial);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
  }

  updateFloorTheme(isDarkMode: boolean) {
    this.isDarkMode = isDarkMode;
    if (this.floorMaterial) {
      const colors = isDarkMode ? this.config.theme.dark : this.config.theme.light;
      this.floorMaterial.color.set(colors.floor);
    }
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
    const d = this.getInitialFrustumSize();
    const aspect = this.viewportWidth() / this.viewportHeight();

    this.updateCameraFrustum(d, aspect);
    this.updateRendererSize();
    this.applyCameraPlacement();
  }

  updateCameraFrustum(d: number, aspect: number) {
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
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
