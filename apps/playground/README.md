# Actions playground

This private React/Vite app demonstrates the public automation surface of
`moyarich/actions`.

It follows the same repository pattern used by MoyaForge:

- the playground lives under `apps/playground`;
- the repository root is an npm workspace;
- repository-owned content stays outside the playground;
- the playground consumes that content directly.

The playground does **not** depend on `@moyarich/moyaforge`. This repository is
an upstream automation dependency for MoyaForge and must remain independently
installable and usable.

## Content ownership

Copyable workflow callers remain authoritative under:

```text
examples/.github/workflows/
```

The playground imports those files directly as raw source. Do not maintain
playground-specific copies.

## Development

From the repository root:

```sh
npm install
npm run dev
```

Build the playground with:

```sh
npm run build:playground
```
