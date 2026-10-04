# Actions playground

This private React/Vite app demonstrates the public automation surface of
`moyarich/actions`.

It follows the same repository pattern used by MoyaForge and Console:

- the playground lives under `apps/playground`;
- authoritative documentation lives under `docs/`;
- authoritative examples live under `examples/`;
- the playground consumes repository-owned content from outside its directory.

The playground does **not** depend on `@moyarich/moyaforge`. This repository is
an upstream automation dependency for MoyaForge and must remain independently
installable and usable.

## Content ownership

Copyable workflow callers are organized as first-class examples:

```text
examples/
├── github-pages/
│   └── workflow.yml
├── node-ci/
│   └── workflow.yml
└── ...
```

The playground imports those files directly as raw source. Do not maintain
playground-specific copies and do not mirror consumer repository paths such as
`examples/.github/workflows/`.

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
