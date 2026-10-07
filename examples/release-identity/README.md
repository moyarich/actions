# Release identity

Resolve the canonical Git tag and GitHub Release name for the root package:

```sh
npm exec -- workspace-release-identity . --pretty-json
```

Resolve a Restore Release source to the exact historical commit:

```sh
npm exec -- workspace-release-identity restore-source \
  'tag:@moyarich/workspace-tools@0.1.0' \
  --repository moyarich/workspace-tools \
  --pretty-json
```

Supported source forms:

```text
commit:<sha>
tag:<tag>
run:<run-id>
artifact:<artifact-id>
github-url:<supported-github-url>
```

For example, the published `0.1.0` GitHub Release URL can be used directly:

```sh
npm exec -- workspace-release-identity restore-source \
  'github-url:https://github.com/moyarich/workspace-tools/releases/tag/%40moyarich%2Fworkspace-tools%400.1.0' \
  --repository moyarich/workspace-tools \
  --pretty-json
```

The resolver normalizes every supported form to the exact full Git commit SHA before Restore Release uses it.

Verify a candidate commit against one or more already-published registry copies:

```sh
npm exec -- workspace-release-identity restore-equivalence . \
  --commit 8b4539e214afc9d87dfbad3e52243e4426c26179 \
  --registry https://npm.pkg.github.com \
  --pretty-json
```

Repeat `--registry` when the exact version exists in more than one registry. The candidate is accepted when **any** published copy matches.
