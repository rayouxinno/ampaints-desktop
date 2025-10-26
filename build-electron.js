import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure dist-electron directory exists
const distDir = join(__dirname, 'dist-electron');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Build main process
await esbuild.build({
  entryPoints: ['electron/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist-electron/main.cjs',
  external: [
    'electron',
    'better-sqlite3',
    'electron-store',
    '../dist/*',
    'vite',
    '@vitejs/plugin-react',
    '@replit/*'
  ],
  packages: 'external',
});

// Build preload script
await esbuild.build({
  entryPoints: ['electron/preload.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist-electron/preload.cjs',
  external: ['electron'],
  packages: 'external',
});

// Build server for electron to dist/ so path resolution works correctly
// (server uses import.meta.dirname + "public" which expects to be in dist/)
// Use index.production.ts which has ZERO vite dependencies
await esbuild.build({
  entryPoints: ['server/index.production.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  external: [
    'better-sqlite3',
    'express',
    'ws'
  ],
  packages: 'external',
});

console.log('✅ Electron files compiled successfully!');
