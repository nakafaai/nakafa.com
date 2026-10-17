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
- The unit suites pass at 100% coverage per file: `pnpm test`
- The typechecks pass for every changed workspace, for example `pnpm --filter www typecheck`
- `pnpm check:tests` passes
- Ultracite passes: `pnpm exec ultracite check`
- React Doctor passes for changed React code: `pnpm run doctor --verbose --scope changed --base main --include-untracked --blocking warning`
- No new lint errors: `pnpm lint`
- Dependency audit passes: `pnpm security:audit`
- Manual testing (desktop/mobile)
- Contribution terms reviewed: `LICENSE`, `CONTENT_LICENSE.md`, and `TRADEMARKS.md`

## Related Issues

Closes #

## Additional Context

Any other information reviewers should know.
