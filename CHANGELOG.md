# Changelog

All notable user-facing changes to this project will be documented in this file.

The changelog is the canonical source used to seed the initial GitHub Release draft. It describes what consumers can do with Moya Workspace Tools, not how this repository is maintained or shipped.

## [0.1.0] - Initial Release

### CI and repository automation

- Run reusable Node.js and package CI with configurable Node versions, install commands, checks, and workspace/package targets.
- Discover publishable workspace packages, including supported root-package and nested workspace layouts, for downstream matrix and release workflows.
- Automatically repair Prettier formatting and `package-lock.json` drift in caller repositories, with dry-run/commit behavior and workflow summaries.
- Generate README screenshots through reusable repository automation.
- Manage native GitHub issue blocking relationships and render dependency trees, including dry-run previews and cycle-aware output.

### Releases and publishing

- Create persistent GitHub Release drafts for repositories and scoped monorepo packages, with semantic-version resolution and dry-run previews.
- Seed a missing release draft from the matching changelog when available, with PR history, scoped commit history, and a minimal initial-release body as fallbacks.
- Preserve existing draft text and generated entries while appending only newly discovered release-note PRs using stable PR markers and a seed baseline.
- Prepare npm package releases with version planning, changelog-aware release state, canonical release commits and tags, and dry-run support.
- Publish npm packages through reusable workflows with package selection, registry/tag configuration, artifact output, and release verification.
- Run the complete npm release lifecycle without replacing existing callers of `reusable_npm-release.yml`.
- Validate, package, and publish VS Code extensions, including dry runs, Marketplace publication, VSIX artifacts, release-environment approval, tag/version verification, and matching GitHub Release publication.
- Validate and publish Codemod Registry packages from configurable package directories.

### Sites and consumer integration

- Build and deploy static sites to GitHub Pages with repository-relative base-path support.
- Use `reusable_*.yml` workflows as the supported cross-repository workflow API.
- Start from documented, copyable caller examples for the supported reusable workflows.
