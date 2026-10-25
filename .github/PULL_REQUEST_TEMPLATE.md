## Description

Briefly describe your changes and what they accomplish.

## Type

- Bug fix
- New feature
- Breaking change
- Documentation
- Refactoring
- Performance

## Testing

- Every browser suite passes on a production build, as the README describes
- The unit suites pass at 100% coverage per file: `bun run test`
- The typechecks pass for every changed workspace, for example `bun --filter www typecheck`
- `bun run check:tests` passes
- Ultracite passes: `bunx ultracite check`
- React Doctor passes for changed React code: `bun run doctor --verbose --scope changed --base main --include-untracked --blocking warning`
- No new lint errors: `bun run lint`
- Dependency audit passes: `bun run security:audit`
- Manual testing (desktop/mobile)
- Contribution terms reviewed: `LICENSE`, `CONTENT_LICENSE.md`, and `TRADEMARKS.md`

## Related Issues

Closes #

## Additional Context

Any other information reviewers should know.
