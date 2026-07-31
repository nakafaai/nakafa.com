# Contributing to nakafa.com

Nakafa is source-available, not open source. Read `LICENSE`,
`CONTENT_LICENSE.md`, and `TRADEMARKS.md` before contributing.

You may create a GitHub fork only to prepare and submit contributions back to
Nakafa. The fork must not be used as a standalone project, hosted service,
mirror, product, rebrand, or distribution channel.

By submitting code, content, data, designs, or another contribution, you
certify that:

- You have the right to submit it.
- It is your original work, or you have permission to submit it.
- It contains no secrets, private data, copied proprietary material, or
  conflicting license terms.
- You grant PT. Nakafa Tekno Kreatif a perpetual, worldwide, non-exclusive,
  royalty-free, sublicensable, and transferable license to use, reproduce,
  modify, distribute, publicly display, publicly perform, create derivative
  works from, and relicense it as part of Nakafa.
- PT. Nakafa Tekno Kreatif may use it in source-available, commercial,
  proprietary, hosted, educational, and internal versions of Nakafa without
  owing you payment.

Do not submit a contribution if you cannot grant these rights.

## Setup

The supported toolchain is declared in `package.json`:

- Node.js 24
- pnpm 10.34.1
- Git

```sh
git clone https://github.com/YOUR-USERNAME/nakafa.com.git
cd nakafa.com
pnpm install --frozen-lockfile
pnpm dev
```

The main web app is available at [http://localhost:3000](http://localhost:3000).

## Before editing

- Read root `AGENTS.md` and the nearest nested `AGENTS.md`.
- Inspect recent history, the owning package, its config, and nearby tests.
- Verify whether a content scope is owned by Aksara or by the remaining local
  `packages/contents` source.
- For Effect work, inspect the pinned read-only `repos/effect` source.
- For Convex work, follow `packages/backend/AGENTS.md` and use an isolated Agent
  Mode deployment.

## Code standards

- Use TypeScript and existing package or app aliases.
- Design effectful domain work as typed Effect programs with schema-derived
  contracts and tagged expected errors.
- Prefer direct, readable control flow, early returns, and small domain-owned
  modules.
- Do not add workaround casts, generic errors, wrapper chains, compatibility
  layers, duplicate sources of truth, or dead migration code.
- Keep tests colocated as `name.test.ts` or `name.test.tsx` and use
  `vitest.config.ts`.
- Use MDX for authored educational content and the existing math components for
  mathematical notation.

## Verification

Run the smallest relevant checks while developing, then the complete affected
workspace gates before opening a pull request:

```sh
pnpm lint
pnpm test
pnpm boundaries
pnpm --filter www typecheck
pnpm build
```

Run typechecks and tests for every other changed workspace. For production-mode
runtime verification, run `pnpm start` after a successful root build.

## Pull requests

1. Branch from current `main`.
2. Keep commits small and cohesive.
3. Open a ready pull request with an accurate title and body.
4. Wait for exact-head CI and review.
5. Reply concisely to each review finding, fix valid findings, and resolve every
   conversation.
6. Re-run affected checks after the final change.

Protected `main` accepts linear squash or rebase merges and rejects merge
commits, force pushes, and unresolved required checks.

## Help

- [GitHub Discussions](https://github.com/nakafaai/nakafa.com/discussions)
- [Security advisories](https://github.com/nakafaai/nakafa.com/security/advisories/new)
