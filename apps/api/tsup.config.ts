import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/server.ts', 'src/db/migrate.ts', 'src/seed.ts', 'src/chain/deploy-cli.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Bundle everything into self-contained files: the runtime image needs no node_modules.
  noExternal: [/.*/],
  external: ['pg-native', 'pino-pretty'],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
