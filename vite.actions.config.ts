import { defineConfig } from "vite";

const entries = {
  "release-draft-sync/index": "src/release-draft-sync/index.ts",
  "discover-packages/index": "src/discover-packages/index.ts",
  "issue-dependency-tree/index": "src/issue-dependency-tree/index.ts",
  "bin/issue-dependency-tree": "src/issue-dependency-tree/cli.ts",
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
        entryFileNames: "[name].mjs",
        banner: (chunk) =>
          chunk.name.startsWith("bin/") ? "#!/usr/bin/env node" : "",
      },
    },
  },
});
