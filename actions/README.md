# Reusable Actions

Public standalone GitHub Actions belong in this directory.

Each supported action uses its own directory containing an `action.yml` or `action.yaml` file:

```text
actions/
└── example/
    └── action.yml
```

External consumers reference public actions as:

```yaml
- uses: moyarich/actions/actions/example@v1
```

The initial `0.1.0` release focuses on reusable workflows; no standalone reusable actions are published yet.
