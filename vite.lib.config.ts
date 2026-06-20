import { defineConfig } from 'vite';
import { resolve } from 'path';

// Library build: emits an embeddable ES + UMD bundle of the OpenKeys engine.
// `three` is a peer dependency (kept external); the three.js addons we use
// (OrbitControls, FontLoader, TextGeometry, RGBELoader) are bundled in.
export default defineConfig({
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/lib/index.ts'),
      name: 'OpenKeys',
      fileName: (format) => `openkeys.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: (id) => id === 'three',
      output: {
        globals: { three: 'THREE' },
      },
    },
  },
});
