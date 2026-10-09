# Workspace Tools documentation playground

React/Vite documentation viewer for Workspace Tools. It renders the canonical MDX pages from root `docs/**/page.mdx` and `examples/**/page.mdx`—those files remain the content sources.

The interface uses a compact header, left documentation navigation, a readable article column, and an automatically generated right-hand **On this page** outline. Headings (`h2`/`h3`) become deep links and the active section is tracked while scrolling. At narrower widths the outline is hidden and navigation becomes scrollable.

## Development

From the repository root:

```sh
npm ci
npm run dev
```

Build the playground:

```sh
npm run build:playground
```

Add or change sections by editing the authoritative docs/examples MDX files, not separate playground copies.
