import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/server_test.ts'],
    format: ['esm'],
    dts: true,
    minify: true,
    sourcemap: true,
    clean: true,
});
