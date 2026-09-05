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
- pnpm 11.23.0
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
cp apps/www/.env.example apps/www/.env.local
```

Fill in the application environment and configure an isolated Convex deployment
using [`packages/backend/AGENTS.md`](packages/backend/AGENTS.md). Content routes
need a populated, verified Aksara signed runtime. An empty backend is not a
complete content fixture.

Run `pnpm dev` for hot reload. Portless starts its HTTPS proxy on port 443
and prints the branch-specific Nakafa URL, such as `https://ci.nakafa.localhost`.
The web, CAS, and email preview servers use the same proxy and receive separate
names. Run `pnpm exec portless list` to inspect active routes or
`pnpm exec portless get nakafa` from the checkout to obtain its web URL.
It creates and trusts a local certificate authority on first use. Run
`pnpm exec portless doctor` to check the proxy, DNS, and certificate trust. Configure
authentication for that exact local origin in your own development deployment
when testing sign-in. Google rejects `.localhost` subdomains as OAuth redirect
URIs. For Google sign-in, configure Portless with a domain you own, then register
the exact HTTPS callback URI in Google and set the development backend's
`SITE_URL` to the matching origin. See the
[Portless OAuth guidance](https://github.com/vercel-labs/portless/blob/main/skills/oauth/SKILL.md).
Signed snapshot runtimes contain inert authentication credentials and are for
content and renderer verification.

For production-mode verification, use your configured nonproduction backend
or prepare a local signed snapshot once. Obtain the current encrypted snapshot,
its selection hash, and the cache key through the authorized project workflow.
Keep `CONTENT_RUNTIME_CACHE_KEY` in your shell's secret environment, then run:

```sh
CONTENT_RUNTIME_SNAPSHOT=/absolute/path/runtime.tar.gpg \
CONTENT_RUNTIME_SELECTION_HASH=<snapshot-selection-hash> \
pnpm runtime:prepare
```

Preparation verifies and imports the snapshot into an isolated database under
`.cache/runtime`. It preserves your existing Convex selection and stops the
temporary backend when preparation finishes. Then use the ordinary commands:

```sh
pnpm build
pnpm start
```

`pnpm build` checks the prepared runtime identity, starts its isolated backend,
and builds against its verified content. Protected Vercel builds read the signed
snapshot directly through the same domain readers. `pnpm start` reopens the
isolated database and serves the existing build through Portless without
rebuilding. Use the printed HTTPS
URL for browser verification. Portless assigns internal application ports;
`PORTLESS_APP_PORT` selects a fixed port when needed. Set `PORTLESS=0` to bypass
the proxy explicitly.

Run the browser suite from the repository root in a second terminal. Point
Playwright at this checkout's URL and let its Node HTTP client trust the same
local certificate authority:

```sh
PLAYWRIGHT_BASE_URL="$(pnpm exec portless get nakafa)" \
NODE_EXTRA_CA_CERTS="${PORTLESS_STATE_DIR:-$HOME/.portless}/ca.pem" \
pnpm --filter www test:browser --workers=1
```

If the proxy uses a custom state directory, set `PORTLESS_STATE_DIR` to that
directory in both terminals.

Stop it before `pnpm runtime:clean` removes the prepared runtime. To refresh
the snapshot, clean it and repeat preparation.

CI uses the same build lifecycle with the current production selection and
`PORTLESS=0` for its fixed-port browser checks. The
protected Vercel integration invokes it through `convex deploy --cmd`; Vercel
keeps public production client URLs, reads build content from the isolated
snapshot, and removes all temporary state when the build ends.

## Repository layout

- `apps/www`: main Next.js application at `https://nakafa.localhost`
- `apps/mcp`: frameworkless Vercel ingress for the Convex MCP runtime
- `apps/api`: frameworkless Vercel ingress for the Convex REST runtime
- `apps/cas`: Python CAS service at `https://cas.nakafa.localhost`
- `apps/email`: email preview application at `https://email.nakafa.localhost`
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
requires reading `repos/effect/.agents/AGENTS.md` plus the relevant implementation,
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

The shared `@nakafa/aksara-contracts/locale` module is the only locale source
of truth. English, Indonesian, and German are active. Next.js routing, API
validation, Convex validators, AI language handling, date formatting, checkout
localization, and sitemap generation derive from that contract. Do not add a
second app-local locale list.

Aksara's signed `page` family owns public legal and company documents. Nakafa
uses the same verified Page projections and artifacts for human routes, footer
navigation, sitemap entries, and Markdown or LLM delivery. Do not restore local
legal MDX, hard-coded legal route catalogs, or another publication path.

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
