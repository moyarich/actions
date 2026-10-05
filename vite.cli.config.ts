import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/issue-dependency-tree/cli.ts",
    target: "node24",
    outDir: "dist/bin",
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "issue-dependency-tree.mjs",
        banner: "#!/usr/bin/env node",
      },
    },
  },
});
