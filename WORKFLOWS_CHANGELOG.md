# Reusable Workflows Changelog

User-facing changes to the reusable workflows and standalone GitHub Actions are documented here. Workflow releases use their own version line and do not change the npm package version.

## [0.1.0] - Initial Release

### Reusable workflows

- Run reusable Node.js and package CI with configurable Node versions, install commands, checks, and workspace/package targets.
- Verify committed distribution output by rebuilding it and preserving rebuilt output when validation fails.
- Discover root, workspace, and direct-child packages and expose normalized package and matrix outputs.
- Check or repair Prettier formatting and root `package-lock.json` drift.
- Preview and create package releases, publish npm packages, maintain release drafts, and delete release tags.
- Build and deploy static sites to GitHub Pages.
- Generate README screenshots through reusable repository automation.
- Publish VS Code extensions and Codemod Registry packages.
- Manage and display native GitHub issue dependencies.

### Standalone actions

- Discover repository packages directly inside a job.
- Reconcile persistent GitHub Release draft content without overwriting maintainer-authored text.
- Render native GitHub issue dependency trees as Markdown and normalized graph data.
