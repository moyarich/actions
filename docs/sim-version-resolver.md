# sim-version-resolver

Resolve semantic versions without modifying files, creating releases, or contacting registries.

```sh
sim-version-resolver --current-version 0.1.0 --mode bump --bump minor
# 0.2.0

sim-version-resolver --current-version 0.1.0 --mode bump --bump minor --json
# {"currentVersion":"0.1.0","nextVersion":"0.2.0","mode":"bump","bump":"minor"}

sim-version-resolver --package-json packages/my-package/package.json --mode package-json --json

sim-version-resolver --current-version 0.1.0 --mode exact --exact-version 0.5.0 --json
```

If `--current-version` is omitted, the CLI reads the specified `--package-json` path (default `package.json`). The same resolver is used by `workspace-release`. Version modes are `bump`, `package-json`, and `exact`; bumps are `major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch`, and `prerelease`.
