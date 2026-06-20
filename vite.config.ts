import { defineConfig } from 'vite';
import { resolve } from 'path';

// `base` is only applied for production builds (GitHub Pages serves the app under
// /Openkeys/). In dev it stays at '/'. Asset URLs in config.ts use
// import.meta.env.BASE_URL so bundled fonts resolve correctly under the sub-path.
export default defineConfig(({ command }) => ({
  root: '.',
  base: command === 'build' ? '/Openkeys/' : '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 5173,
    open: true,
    strictPort: true,
    fs: {
      strict: true,
      allow: ['..']
    }
  },
  plugins: []
}));
