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
- pnpm 11.25.0
- Turborepo
- Next.js 16 and React 19
- Native TypeScript 7
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

Fill in the application environment and use the main dev deployment selected
in `packages/backend/.env.local` (see
[`packages/backend/AGENTS.md`](packages/backend/AGENTS.md)). Content routes
need a populated, verified Aksara signed runtime. An empty backend is not a
complete content fixture.

Nakafa uses Portless HTTPS URLs for local development. Google rejects
`.localhost` subdomains as OAuth redirect URIs, so configure the proxy with
Nakafa's owned development suffix before testing Google sign-in:

```sh
pnpm exec portless proxy start --tld local.nakafa.com
```

Stop an existing proxy before changing its suffix. This setting is shared by
local projects. Portless listens on port 443, creates and trusts a local
certificate authority, and registers local DNS entries for running apps.

Run `pnpm dev` for hot reload. The canonical checkout serves
`https://nakafa.local.nakafa.com`; worktrees receive their own prefix, such as
`https://ci.nakafa.local.nakafa.com`. The web, CAS, and email preview servers
receive separate names. Use `pnpm exec portless list` to inspect active routes,
`pnpm exec portless get nakafa` to obtain this checkout's web URL, and
`pnpm exec portless doctor` to check the proxy, DNS, and certificate trust.

Set `SITE_URL` in `apps/www/.env.local` and the selected development backend
to that exact web origin. Set `NEXT_PUBLIC_CONVEX_URL` and
`NEXT_PUBLIC_CONVEX_SITE_URL` to the same main dev deployment.
Google's client configuration must include the web origin under authorized
JavaScript origins and `<web-origin>/api/auth/callback/google` under authorized
redirect URIs. A worktree needs its exact callback registered separately;
Google does not accept wildcard callbacks. See the
[Portless OAuth guidance](https://github.com/vercel-labs/portless/blob/main/skills/oauth/SKILL.md).
Acceptance databases use inert authentication credentials. Real sign-in requires
a development backend configured with the Google client credentials.

Ordinary `pnpm build` and `pnpm start` use your configured nonproduction backend.
For a reproducible production-mode acceptance run, use:

```sh
pnpm acceptance:prepare
pnpm acceptance:build
pnpm acceptance:start
```

Preparation creates a private native Convex database under `.cache/acceptance`,
checks out the reviewed Aksara revision pinned in
`packages/backend/scripts/content/acceptance/source.json`, and publishes its
fixed acceptance selection through Aksara's normal signed publication protocol.
It uses an ephemeral local signer and needs no production deployment or signing
credentials. Aksara owns every authored source and validates complete lesson
groups, exam sets, locales, and structured snapshots before activation.

The acceptance build and start commands run ordinary app commands with that
isolated backend. They preserve your normal Convex selection and stop the owned
backend when the operation ends. Use the printed Portless HTTPS URL for browser
verification. `PORTLESS_APP_PORT` selects an internal port; `PORTLESS=0` uses the
app port directly.

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

Stop acceptance services before `pnpm acceptance:clean` removes their database,
source checkout, signer, and logs. Cleanup verifies filesystem ownership and
refuses a database whose identity changed. To refresh the fixture, clean it and
repeat preparation. Update the pinned Aksara revision deliberately when the
acceptance contract needs new reviewed examples.

CI runs the same isolated acceptance commands with `PORTLESS=0`. Protected
Vercel builds run only after a protected main merge. The web build command
deploys Convex functions before building Next.js because prerendering queries
those functions. Vercel supplies `NEXT_PUBLIC_CONVEX_URL`, which the runtime
guard verifies against the protected production deployment. Convex's `--cmd`
runs before the backend deployment and cannot be used for this ordering.
Builds query bounded real published samples and verify the signed content with
the current renderer. App builds do not export or import production tables or
release history. Full corpus validation remains in Aksara's publication and
renderer compatibility checks.

## Repository layout

- `apps/www`: main Next.js application at `https://nakafa.local.nakafa.com`
- `apps/mcp`: frameworkless Vercel ingress for the Convex MCP runtime
- `apps/api`: frameworkless Vercel ingress for the Convex REST runtime
- `apps/cas`: Python CAS service at `https://cas.nakafa.local.nakafa.com`
- `apps/email`: email preview application at `https://email.nakafa.local.nakafa.com`
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
