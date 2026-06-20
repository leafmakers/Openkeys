import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export class Scene {
  public scene!: THREE.Scene;
  public renderer!: THREE.WebGLRenderer;
  public camera!: THREE.OrthographicCamera;
  public controls!: OrbitControls;
  private ambientLight!: THREE.AmbientLight;
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private backLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private floor!: THREE.Mesh;
  private floorMaterial!: THREE.MeshLambertMaterial;
  private isDarkMode: boolean = false;

  constructor() {
    this.initializeScene();
    this.setupRenderer();
    this.setupCamera();
    this.setupLights();
    this.setupControls();
    this.setupFloor();
    this.loadEnvironment();
    this.animate = this.animate.bind(this);
  }

  initializeScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#ffffff');
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true
    });

    this.configureRenderer();
    this.setupRendererSize();
    document.body.appendChild(this.renderer.domElement);
  }

  configureRenderer() {
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    (this.renderer as any).physicallyCorrectLights = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    (this.renderer as any).outputEncoding = (THREE as any).sRGBEncoding;
  }

  setupRendererSize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  getInitialFrustumSize() {
    return window.innerWidth <= 480 ? 45 : 80;
  }

  setupCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const d = this.getInitialFrustumSize();
    
    this.camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect,
      d, -d,
      1, 1000
    );

    const isMobile = window.innerWidth <= 480;
    if (isMobile) {
      this.camera.position.set(-45, 45, 45);
      this.camera.lookAt(0, 20, 0);
    } else {
      this.camera.position.set(-80, 80, 80);
      this.camera.lookAt(0, 35, 0);
    }
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.configureControls();
  }

  configureControls() {
    this.controls.target.set(5, 20, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 3;
    this.controls.minPolarAngle = Math.PI / 5;
    this.controls.enableZoom = true;
    this.controls.minZoom = 0.8;
    this.controls.maxZoom = 1.5;
    this.controls.enablePan = false;
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
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);
  }

  setupKeyLight() {
    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.keyLight.position.set(100, 200, 100);
    this.configureKeyLightShadow();
    this.scene.add(this.keyLight);
  }

  configureKeyLightShadow() {
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 4096;
    this.keyLight.shadow.mapSize.height = 4096;
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
    // Fill light from opposite side to soften shadows
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.fillLight.position.set(-100, 150, -100);
    this.fillLight.castShadow = false; // No additional shadows
    this.scene.add(this.fillLight);
  }

  setupBackLight() {
    // Soft back lighting to reduce contrast
    this.backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    this.backLight.position.set(0, 100, -150);
    this.backLight.castShadow = false; // No additional shadows
    this.scene.add(this.backLight);
  }

  setupRimLight() {
    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    this.rimLight.position.set(0, -50, 100);
    this.rimLight.castShadow = false;
    this.scene.add(this.rimLight);
  }

  updateLightPosition(angle: number) {
    const radius = 250;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    this.keyLight.position.set(x, 200, z);
  }

  setupFloor() {
    const floorGeometry = new THREE.PlaneGeometry(20000, 20000);
    
    // Create halftone shadow texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    // Create subtle halftone pattern for shadows
    ctx.fillStyle = this.isDarkMode ? '#252525' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const dotSize = 0.8;
    const spacing = 8;
    ctx.fillStyle = this.isDarkMode ? '#fcfaf6' : '#3c4142';
    
    for (let x = 0; x < canvas.width; x += spacing) {
      for (let y = 0; y < canvas.height; y += spacing) {
        const offsetX = (y / spacing) % 2 === 0 ? 0 : spacing / 2;
        ctx.beginPath();
        ctx.arc(x + offsetX, y, dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    const shadowTexture = new THREE.CanvasTexture(canvas);
    shadowTexture.wrapS = THREE.RepeatWrapping;
    shadowTexture.wrapT = THREE.RepeatWrapping;
    shadowTexture.repeat.set(8, 8);
    
    this.floorMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: false,
      side: THREE.DoubleSide
    });

    this.floor = new THREE.Mesh(floorGeometry, this.floorMaterial);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = 0;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
  }

  updateFloorTheme(isDarkMode: boolean) {
    if (this.floorMaterial) {
      this.floorMaterial.color.setHex(isDarkMode ? 0x3c4142 : 0xffffff);
      // Ensure pure white in light mode
      if (!isDarkMode) {
        this.floorMaterial.color.setRGB(1.0, 1.0, 1.0); // This matches #ffffff
      }
    }
  }

  loadEnvironment() {
    new RGBELoader()
      .setPath('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/')
      .load('royal_esplanade_1k.hdr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
      });
  }

  handleResize() {
    const d = this.getInitialFrustumSize();
    const aspect = window.innerWidth / window.innerHeight;
    
    this.updateCameraFrustum(d, aspect);
    this.updateRendererSize();

    // Reposition camera for mobile/desktop
    const isMobile = window.innerWidth <= 480;
    if (isMobile) {
      this.camera.position.set(-45, 45, 45);
      this.camera.lookAt(0, 20, 0);
    } else {
      this.camera.position.set(-80, 80, 80);
      this.camera.lookAt(0, 35, 0);
    }
  }

  updateCameraFrustum(d: number, aspect: number) {
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();
  }

  updateRendererSize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
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
}