import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/release-draft-sync/index.ts",
    target: "node24",
    outDir: "dist/release-draft-sync",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "index.mjs",
      },
    },
  },
});
