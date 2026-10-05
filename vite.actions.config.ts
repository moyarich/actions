import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/release-draft-sync/index.ts",
    target: "node24",
    outDir: "release-draft-sync/dist",
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
