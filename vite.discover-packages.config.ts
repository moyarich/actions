import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/discover-packages/index.ts",
    target: "node24",
    outDir: "dist/discover-packages",
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
