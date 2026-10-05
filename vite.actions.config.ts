import { defineConfig } from "vite";

const entries = {
  "release-draft-sync": "src/release-draft-sync/index.ts",
  "discover-packages": "src/discover-packages/index.ts",
  "issue-dependency-tree": "src/issue-dependency-tree/index.ts",
};

export default defineConfig({
  build: {
    ssr: Object.values(entries),
    target: "node24",
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: entries,
      output: {
        entryFileNames: "[name]/index.mjs",
      },
    },
  },
});
