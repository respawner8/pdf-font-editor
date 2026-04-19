import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };
import path from 'node:path';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { target: 'esnext', sourcemap: true },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['test/unit/**/*.test.ts']
  }
});
