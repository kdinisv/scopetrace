# Release Checklist

## Before first public publish

- Verify the npm package name is still available: `npm view scopetrace name version`
- Create the public repository remote and push the default branch
- Add `repository`, `homepage`, and `bugs` fields to `package.json` once the final repository URL exists
- Confirm the license text in `LICENSE` matches the intended ownership model
- Review `README.md` for examples, API accuracy, and installation text

## Quality gate

- Run `npm run check`
- Run `npm run pack:dry-run`
- Inspect the tarball contents and size
- Confirm the package only includes the expected runtime artifacts

## Suggested package.json metadata

Add these fields after the repository URL exists:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/<owner>/scopetrace.git"
  },
  "homepage": "https://github.com/<owner>/scopetrace#readme",
  "bugs": {
    "url": "https://github.com/<owner>/scopetrace/issues"
  }
}
```

## Publish flow

1. Bump `version` in `package.json`
2. Commit the release changes
3. Create a git tag matching the version
4. Run `npm publish`

## Post-publish

- Install the published package in a clean sample project
- Verify both ESM and CJS imports
- Verify `report()` and formatter exports from the published tarball
- Check the npm package page for README rendering and metadata
- Open the GitHub release or changelog entry if you maintain one
