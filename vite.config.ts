import { defineConfig } from 'vite';
import { resolve } from 'path';

// `base` differs per deploy target. GitHub Pages serves under /Openkeys/, so the
// production build there needs that sub-path. Vercel (and dev) serve at the domain
// root, so base must be '/' — Vercel sets process.env.VERCEL during its build, which
// we detect here. Asset URLs in config.ts use import.meta.env.BASE_URL so bundled
// fonts resolve correctly under whichever base is active.
export default defineConfig(({ command }) => ({
  root: '.',
  base: command === 'build' && !process.env.VERCEL ? '/Openkeys/' : '/',
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
    // Honor an externally assigned port (e.g. the preview harness sets PORT) and
    // fall back to 5173 for a plain `npm run dev`. strictPort stays off so a busy
    // 5173 rolls to the next free port instead of hard-failing.
    port: Number(process.env.PORT) || 5173,
    open: !process.env.PORT, // auto-open a tab only for manual dev, not under the harness
    strictPort: false,
    fs: {
      strict: true,
      allow: ['..']
    }
  },
  plugins: []
}));
