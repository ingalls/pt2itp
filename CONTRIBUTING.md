# Contributing

## Merging Pull Requests

All PRs to master _must_ have a corresponding versioned release

- add CHANGE.md comment following current formatting
- `git commit -am "Update CHANGELOG"`
- bump patch version in package.json
  - `npm version patch` for bug fixes
  - `npm version minor` for internal breaking changes or external (cli) new features
  - `npm version major` for breaking external (cli) changes
  - When in doubt - numbers are cheap
- `git push`
- `git push --tags`
- `npm pub`
