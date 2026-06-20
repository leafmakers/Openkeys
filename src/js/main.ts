import { Scene } from './scene';
import { Keyboard } from './keyboard';
import { UI } from './ui';

class Application {
  private scene: Scene | null;
  private keyboard: Keyboard | null;
  // private ui: UI | null; // Initialized but not used elsewhere
  private isRunning: boolean;

  constructor() {
    this.scene = null;
    this.keyboard = null;
    // this.ui = null;
    this.isRunning = false;
  }

  initialize() {
    try {
      // Initialize core components
      this.scene = new Scene();
      this.keyboard = new Keyboard(this.scene);
      new UI(this.keyboard, (this.scene as any).renderer); // UI initializes itself
      
      // Start animation loop
      this.isRunning = true;
      this.animate();

      // Setup event listeners after components are initialized
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.handleInitializationError(error);
    }
  }

  private setupEventListeners() {
    window.addEventListener('resize', () => {
      if (this.scene) {
        this.scene.handleResize();
      }
    });

    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
  }

  private animate() {
    if (!this.isRunning) return;

    try {
      requestAnimationFrame(this.animate.bind(this));
      
      if (this.keyboard) {
        this.keyboard.update();
      }
      
      if (this.scene) {
        (this.scene as any).controls.update();
        (this.scene as any).renderer.render((this.scene as any).scene, (this.scene as any).camera);
      }
    } catch (error) {
      console.error('Animation loop error:', error);
      this.handleRuntimeError(error);
    }
  }

  private handleInitializationError(error: unknown) {
    // Display user-friendly error message
    const errorMessage = document.createElement('div');
    errorMessage.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fee2e2;
      color: #991b1b;
      padding: 20px;
      border-radius: 8px;
      font-family: system-ui;
      text-align: center;
      z-index: 9999;
    `;
   const errorDetails = error instanceof Error ? error.message : String(error);
    errorMessage.innerHTML = `
      <h2>Failed to start application</h2>
     <p>Please refresh the page or try again later.</p>
     <details style="margin-top: 10px; text-align: left; font-size: 12px;">
       <summary>Technical details</summary>
       <pre style="white-space: pre-wrap; margin-top: 5px;">${errorDetails}</pre>
     </details>
    `;
    document.body.appendChild(errorMessage);
  }

  private handleRuntimeError(error: unknown) {
    console.error('Runtime error:', error);
    this.isRunning = false;
  }

  private handleGlobalError(event: ErrorEvent) {
    console.error('Global error:', event.error);
    event.preventDefault();
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent) {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
  }

  shutdown() {
    this.isRunning = false;
    
    // Cleanup resources
    if (this.scene) {
      (this.scene as any).renderer.dispose();
      (this.scene as any).controls.dispose();
    }
    
    // Remove event listeners
    if (this.scene) {
      window.removeEventListener('resize', (this.scene as any).handleResize);
    }
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new Application();
  app.initialize();

  // Handle cleanup on page hide/unload
  window.addEventListener('pagehide', () => {
    app.shutdown();
  }, { once: true });
});