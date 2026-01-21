# Fix Dependency & Peer Version Mismatches

## 1. Root Configuration Updates
We will add a `pnpm.overrides` section to the root `package.json`. This is the standard way to tell the package manager: *"I know these packages ask for React 18, but force them to use the installed React 19 versions."*

This will resolve:
- `unmet peer react@"^16.8 || ^17 || ^18"`
- `unmet peer react-dom@"^16.8 || ^17 || ^18"`

## 2. Fix Missing Dependencies
We will add `hono` to `packages/design-system`.
- The error `missing peer hono@^4` occurs because a transitive dependency needs it.
- Installing it explicitly satisfies the requirement.

## 3. Verification
- Run `pnpm install` to apply the overrides and generate a clean lockfile.
- Verify the terminal warnings are reduced or eliminated.