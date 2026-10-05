# Changelog

All notable user-facing changes to this project will be documented in this file.

The changelog is the canonical source for public GitHub Release notes. It describes what consumers can do with Moya Actions, not how maintainers build, test, or publish it.

## [0.1.0] - Initial Release

### Reusable workflows

- Run standardized Node.js and package CI across repositories.
- Automatically repair Prettier formatting and `package-lock.json` drift in caller repositories.
- Discover workspace packages for monorepo automation.
- Deploy static sites to GitHub Pages from reusable workflows.
- Generate README screenshots as part of repository automation.
- Manage issue dependencies and render dependency trees for GitHub issues.
- Use `reusable_*.yml` workflows as the supported cross-repository workflow API.

### Compatibility and consumer tooling

- Resolve published workspace tooling directly in consumer repositories.
- Use documented copyable caller examples for supported reusable workflows.
- Build documentation sites and consumer workflows against repository-relative Pages base paths.
