# Contributing

## Merging Pull Requests

All PRs to master _must_ have a corresponding versioned release

- add CHANGE.md comment following current formatting
- `git commit -am "Update CHANGELOG"`
- bump patch version in package.json
  - `yarn version`
    - `0.0.x` for bug fixes
    - `0.x.0` for internal breaking changes or external (cli) new features
    - `x.0.0` for breaking external (cli) changes
  - When in doubt - numbers are cheap
- `git push`
- `git push --tags`
- CI will publish a draft release to GitHub on tag push.
- push to the npm registry
  - `yarn publish`
