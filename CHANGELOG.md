# Changelog

## 0.1.1

### Added

- add reusable workflow version source
- support release notes overrides in generic release
- add generic reusable release workflow
- add independent reusable workflow releases
- anchor canonical artifact to release commit
- recover canonical tarball for later registry publishes
- accept published release as canonical package source
- accept canonical package tarball in publish CLI
- publish verified canonical package artifacts
- expose publish plan for provenance checks
- attach packaged distribution to GitHub releases
- show changelog and release draft content in publish summary
- expand publish preflight summary
- add dry-run and fuzzy tag search
- add release tag deletion workflow
- publish to all supported registries
- show changelog and release draft in summary
- use Inter variable font family
- load Inter variable font
- add Inter variable font
- publish issue dependency tree CLI
- make issue dependency CLI executable
- add issue dependency tree action
- add interactive issue dependency tree CLI
- add issue dependency tree action entry point
- add issue dependency tree action adapter
- add issue dependency GitHub adapter
- add issue dependency tree core
- run release draft sync action
- add release draft sync action
- add release draft sync source
- render playground files with Monaco
- add Monaco editor to playground
- add explicit multi-file example playground
- show real callers with reusable workflow source
- make Release Drafter persistent and append-only
- add stable PR markers to drafter templates
- add persistent draft reconciliation helper
- render authoritative workflow examples
- add MDX content registry
- add multi-source MDX shell
- add actions playground workspace
- migrate reusable automation from dev-toolkit

### Changed

- prepare 0.1.1 changelog
- format repository
- improve workspace-tools README
- complete and correct CLI examples
- split reusable workflows into dedicated repository
- align package release guide with generic release workflow
- document independent package and workflow releases
- update workflows changelog references
- rename workflows changelog
- separate package and workflow changelogs
- pin examples to workflow release tags
- document independent workflow versioning
- delegate npm GitHub releases to generic workflow
- release workflows through generic release
- add reusable workflow changelog
- validate packaged CLI bin entry points
- source packages only from release assets or tags
- describe canonical package artifact reuse
- report GitHub release state generically
- update action dist
- describe packaged release assets
- avoid registry network access in CLI validation
- include release content in publish summary
- describe publish preflight summary
- cover all registry selection
- update publish CLI registry validation
- refine reusable tag deletion changelog
- update reusable tag deletion behavior
- describe tag dry-run and fuzzy lookup
- ignore workflow files in prettier
- document reusable tag deletion
- add reusable delete tag workflow
- replace delete tag workflow with reusable workflow
- Update delete-release-tag.yml
- format release workflow
- separate release and publish responsibilities
- describe independent release and publish workflows
- define publish dry-run as preflight
- separate release from publishing
- keep release example independent from publish
- make release workflow release-only
- decouple release from package publishing
- update publish CLI bundle
- Update release.yml
- describe reusable workflows in changelog
- require explicit tag in publish example
- explain suggested versus selected dist-tags
- document explicit npm distribution tags
- update bundled publish CLI
- cover suggested npm dist-tags
- resolve publish distribution tag from package version
- resolve npm distribution tag from release version
- default publish distribution tag to auto
- default release distribution tag to auto
- expand package keywords
- self-heal package-lock.json
- finalize package metadata for 0.1.0
- add package publisher and author metadata
- show package metadata in release summary
- add npm package metadata
- cover root release identity
- add distribution check summary
- document manual distribution check
- add manual distribution check
- cover root package selector
- Organize GitHub Actions and runtime bundles
- document centralized action entrypoints
- import centralized action entrypoints
- auto-discover action entrypoints
- centralize GitHub Action entrypoints
- fix publish dependency-check import
- document feature-named source layout
- update CLI example repository
- describe feature-based source layout
- clean feature module boundaries
- mirror feature source layout
- wire named feature sources
- add workspace feature source
- name feature sources explicitly
- split workspace capabilities by feature
- organize package publishing source
- expand initial release changelog
- update workspace-tools package identity
- use Workspace Tools product name
- finish workspace-tools repository rename
- update example workflow repository references
- update workspace-tools repository identity
- use workspace-tools repository identity
- add check-dist workflow example
- link check-dist workflow reference
- add check-dist workflow to catalog
- document reusable dist verification
- run dist verification independently
- add reusable dist verification workflow
- resolve workspace CLI fixtures from repository root
- Move workspace release tooling into actions
- document action plus CLI convention
- add issue dependency tree action and CLI
- bundle action and CLI runtimes
- add Vite CLI bundle
- add issue dependency tree action entry
- use issue dependency tree action
- cover issue dependency tree core
- add action and CLI bundle entries
- Standardize reusable JavaScript actions
- ignore generated dist in Prettier
- clarify committed root dist convention
- use realistic release draft marker in smoke test
- smoke-test packaged release draft action
- namespace release draft sync markers
- track root action dist without per-action ignores
- document Vitest action test boundary
- run action tests with Vitest
- add release draft action adapter coverage
- add release draft sync core coverage
- isolate GitHub Action adapter
- extract release draft sync core
- split release draft action entry point
- define source and action dist boundaries
- document release draft sync action
- move release draft logic into action source
- self-heal action dist
- validate committed action dist
- track bundled action runtime
- sync Vite action dependency
- add Vite action scripts
- point action at shared dist output
- centralize action dist output
- configure Vite action bundling
- make vscode-extension-publish playground files explicit
- make show-issue-dependency-tree playground files explicit
- make readme-screenshots playground files explicit
- make prettier-self-heal playground files explicit
- make package-ci playground files explicit
- make npm-release playground files explicit
- make npm-publish playground files explicit
- make npm-prepare-release playground files explicit
- make npm-lockfile-self-heal playground files explicit
- make node-ci playground files explicit
- make manage-issue-dependencies playground files explicit
- make github-release playground files explicit
- make github-pages playground files explicit
- make discover-packages playground files explicit
- make codemod-publish playground files explicit
- expose generic playground to MDX
- separate caller and reusable workflow sources
- clarify playground consumer experience
- present examples as real workflow usages
- make release rules consumer-facing
- document reusable workflow API
- define workflow script boundary
- clarify public release note rules
- describe initial release capabilities
- sync root package lock metadata
- define persistent release draft contract
- validate persistent draft reconciliation
- Add reusable and repository Release Drafter workflows
- Define product-facing changelog and release-note rules
- add playground MDX pages
- lock MDX routing dependencies
- add MDX routing dependencies
- declare Prettier for self-healing workflow
- add local package-lock self-healing workflow
- add local Prettier self-healing workflow
- deploy Actions playground to GitHub Pages
- align examples with MoyaForge layout
- document playground ownership boundary
- document actions playground
- define examples playground boundary
- document copyable workflow examples
- add copyable reusable workflow examples
- Initial commit

### Fixed

- support root package version bumps
- allow release workflow to read GitHub Packages
- surface draft content in run summary
- run manual workflows against selected ref
- support multiple draft include paths
- support explicit release draft path scopes
- keep workflow releases as GitHub drafts
- allow supplied release notes without changelog lookup
- skip CLI validation for packages without bin entries
- validate packaged bins without assuming help flags
- preserve already-published GitHub release state
- allow canonical artifact publish after main advances
- report combined publish preflight accurately
- accept all registry selection
- make tag deletion idempotent
- push canonical release tag explicitly
- render release tag safely in summary
- validate root package without workspace flag
- allow empty distribution tag in release validation
- keep unset distribution tag blank
- make release dist-tag an explicit choice
- make npm dist-tag explicit in publish workflow
- stop defaulting publish CLI to latest
- require explicit npm distribution tag
- show resolved release distribution tag
- wire automatic distribution tag resolution
- handle missing release tags
- align root release identity
- support root package release selector
- bundle CLI runtime dependencies
- let Vite own CLI shebangs
- pass reconciled release body to draft writer
- dispatch final CI without repository checkout
- avoid PR approval loops for self-heal
- avoid PR approval loops for CI
- keep generated dist out of prettier self-heal
- validate final self-healed head
- use recursion-safe token for self-heal
- prevent recursive self-heal workflow runs
- let formatter self-heal workflow files
- allow self-heal to push workflow formatting
- preserve release version token
- migrate repository Release Drafter config
- migrate package Release Drafter config
- update Release Drafter integration
- require publishable GitHub package metadata
- configure root package for GitHub Packages
- draft public root package on push
- make actions root package public
- keep package draft caller manual in actions repo
- make package discovery self-contained
- pass release drafter caller permissions
- preserve legacy draft baseline and config path
- build playground with GitHub Pages base path
- avoid lockfile-dependent cache in Pages bootstrap
- serialize self-healing in one workflow
- allow lockfile self-heal to bootstrap missing lockfile
- harden reusable Pages workflow

### Removed

- remove old workflows changelog name
- remove default dist-tag from release entrypoint
- remove default dist-tag from publish entrypoint
- remove feature-local action entrypoints
- remove temporary grouped tests
- remove superseded feature tests
- remove superseded feature source
- remove obsolete nested action convention
- remove inferred workflow example loader

All notable user-facing changes to the installable `@moyarich/workspace-tools` package are documented in this file.

Reusable GitHub workflows and standalone actions are released separately from `moyarich/reusable-workflows`.

## [0.1.1]

### Publishing

- **Reuse canonical package artifacts** — `workspace-publish --artifact-file <file>` can publish an existing npm package tarball instead of rebuilding the package from the current checkout.
- **Validate reused artifacts before publishing** — Existing tarballs must contain a readable `package/package.json` whose package name and version match the selected workspace package.
- **Preserve identical package bytes across registries** — A previously created canonical tarball can be reused for later registry publication, allowing GitHub Packages and npm to receive the same package artifact even when they are published at different times.

## [0.1.0] - Initial Release

### Workspace discovery and dependency tooling

- **`discover-packages`** — Discover root, workspace, or direct-child packages with filtering and JSON output.
- **`workspace-dependency-check`** — Check external dependencies for outdated versions and detect internal workspace version mismatches.
- **`workspace-package-lock`** — Review or recreate the root npm lockfile, with dry-run and commit modes.

### Releases and publishing

- **`workspace-release-identity`** — Resolve canonical package versions, Git tags, and GitHub Release names.
- **`workspace-release`** — Preview or prepare package releases using semantic bumps, exact versions, or the version already present in `package.json`.
- **`workspace-publish`** — Validate and publish workspace packages with registry, distribution-tag, access, dependency, artifact, dry-run, and Git tag verification controls.

### Issue dependencies

- **`issue-dependency-tree`** — Inspect native GitHub issue dependencies from the terminal, select roots explicitly or interactively with optional `fzf` multi-select, and emit Markdown or JSON output.
