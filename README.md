# Nakafa

[![DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/nakafaai/nakafa.com)

Nakafa is a source-available educational platform for structured learning,
assessments, Quran study, and political analysis. The production site is
[nakafa.com](https://nakafa.com).

This repository owns the React and Next.js applications, design system,
transactional Convex backend, renderer implementations, user state, and
product integrations. The separate
[Aksara repository](https://github.com/nakafaai/aksara) owns authored content
and signed publication artifacts for every content scope. `packages/contents`
contains only live Nakafa product, formatting, and agent contracts. It is not an
authored content source or publication path.

## Toolchain

`package.json` is the toolchain source of truth:

- Node.js 24
- pnpm 10.34.1
- Turborepo
- Next.js 16 and React 19
- TypeScript 7 CLI with TypeScript 6 API compatibility
- Convex
- Vitest
- Biome through Ultracite

Do not add `.npmrc`, `.node-version`, `.nvmrc`, or another package-manager
contract unless the repository gains a measured need that `package.json`
cannot express.

## Setup

```sh
git clone https://github.com/nakafaai/nakafa.com.git
cd nakafa.com
pnpm install --frozen-lockfile
pnpm dev
```

The main web app is available at [http://localhost:3000](http://localhost:3000).

For production-mode local verification:

```sh
pnpm build
pnpm start
```

## Repository layout

- `apps/www`: main Next.js application on port 3000
- `apps/mcp`: MCP application on port 3001
- `apps/api`: API application on port 3002
- `apps/cas`: Python CAS service on port 3003
- `apps/email`: email preview application on port 3004
- `packages/backend`: Convex schema, functions, workflows, and integrations
- `packages/design-system`: shared React components and renderer implementations
- `packages/ai`: Effect-native AI capabilities
- `packages/contents`: Nakafa product, formatting, route-context, learner, and
  agent contracts
- `packages/testing`: shared Vitest configuration
- `packages/utilities`: generic cross-domain primitives
- `repos/effect`: read-only Effect source pinned to the installed version

Read the nearest `AGENTS.md` before working. Convex changes also require
`packages/backend/AGENTS.md` and the generated Convex guidelines. Effect work
requires reading `repos/effect/AGENTS.md` plus the relevant implementation,
tests, type-level tests, module structure, and API design in the vendored source.

## Commands

```sh
pnpm dev
pnpm dev:all
pnpm build
pnpm start
pnpm test
pnpm test:coverage
pnpm lint
pnpm security:audit
pnpm format
pnpm boundaries
pnpm effect:source:check
```

There is no root typecheck script. Run the typecheck owned by each changed
workspace, for example:

```sh
pnpm --filter www typecheck
pnpm --filter @repo/backend typecheck
pnpm --filter @repo/design-system typecheck
```

Tests use Vitest config files owned by each workspace. Keep tests colocated as
`name.test.ts`, import the Vitest APIs they use, and preserve the workspace's
configured per-file coverage gate. Final tests only target real colocated `.ts`
Modules. Do not commit tests for `.tsx` Modules, rename React tests to hide them
as `.test.ts`, create `__tests__` folders, or add duplicate test-only source
Modules. Verify rendered React behavior through production Browser or E2E
acceptance.

## Content ownership

Do not add substitute content or duplicate Aksara-owned source to this
repository. Authored educational content changes belong in `nakafaai/aksara`.
Nakafa consumes only authenticated current Aksara contracts and signed
publication artifacts.

Renderer and component implementations remain in Nakafa. Aksara content refers
to reviewed renderer contracts and never carries duplicate React or TSX
implementations.

## Contributing

Read [`AGENTS.md`](AGENTS.md) and
[`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md). Submit a ready pull request
from a branch, keep it current with `main`, resolve review conversations, and
run the relevant exact-head checks before merge.

## License

Nakafa uses a source-available license model and is not open source under the
Open Source Definition.

| Area | License or policy |
| --- | --- |
| Software source code | [Nakafa Source Available License 1.0](LICENSE) |
| Educational content, articles, exercises, datasets, and media | [Nakafa Content License 1.0](CONTENT_LICENSE.md) |
| Names, logos, domains, product names, UI identity, and brand assets | [Nakafa Trademark and Brand Policy](TRADEMARKS.md) |

Commercial, hosted, redistribution, modification, white-label, rebrand, and
AI-training uses require prior written permission from PT. Nakafa Tekno
Kreatif. See the license files for the complete terms.

Reference material:

- [Open Source Definition](https://opensource.org/definition-annotated)
- [GitHub licensing documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- [PolyForm licenses](https://polyformproject.org/licenses)

For commercial licensing inquiries: <nakafaai@gmail.com>
