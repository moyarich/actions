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

## Tabbed code examples

Use `<CodeGroup>` and `<CodeTab label="...">` directly in canonical MDX documentation. Put a fenced Markdown code block inside each tab. The MDX build highlights those fenced blocks with Shiki; no separate code string or client-side syntax highlighter is needed.

```mdx
<CodeGroup>
<CodeTab label="npm">

\`\`\`sh
npm exec -- workspace-publish . --registry=npm --dry-run
\`\`\`

</CodeTab>
<CodeTab label="GitHub Packages">

\`\`\`sh
npm exec -- workspace-publish . --registry=github --dry-run
\`\`\`

</CodeTab>
</CodeGroup>
```

Tabs support mouse selection, Left/Right arrow keys, Home, and End. Keep full code examples in `docs/` or `examples/` rather than duplicating them in the React application.
