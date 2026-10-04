# Moya Actions

Reusable GitHub Actions, workflows, scripts, and release automation for Node.js, npm packages, VS Code extensions, documentation sites, and other Moya projects.

## Public API

This repository uses directory and naming conventions to make the supported automation surface explicit:

- `.github/workflows/reusable_*.yml` — public reusable workflows
- `actions/*/action.yml` — public reusable actions
- `scripts/*` — reusable scripts and repository tooling
- non-`reusable_*` workflows — automation used by this repository itself

Reusable workflows must live directly in `.github/workflows/`, so the `reusable_` prefix is the public/private boundary for workflows.

## Documentation

See [docs](./docs/page.mdx) for getting started, the workflow catalog, and repository conventions.

## Versioning

Consumers should pin a release tag or stable major tag when available:

```yaml
jobs:
  ci:
    uses: moyarich/actions/.github/workflows/reusable_node-ci.yml@v1
```

## License

MIT
