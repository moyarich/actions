import { fileURLToPath, URL } from "node:url";
import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import remarkFrontmatter from "remark-frontmatter";
import rehypePrettyCode from "rehype-pretty-code";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { defineConfig } from "vite";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE_PATH || process.env.PAGES_BASE_PATH || "/",
  plugins: [
    {
      enforce: "pre",
      ...mdx({
        include: /\.(?:md|mdx)$/,
        providerImportSource: "@mdx-js/react",
        rehypePlugins: [
          [rehypePrettyCode, { theme: "github-dark", keepBackground: false }],
        ],
        remarkPlugins: [
          remarkFrontmatter,
          remarkGfm,
          [remarkMdxFrontmatter, { name: "meta" }],
        ],
      }),
    },
    react({ include: /\.(?:js|jsx|md|mdx|ts|tsx)$/ }),
  ],
  server: {
    fs: {
      allow: [repositoryRoot],
    },
  },
});
