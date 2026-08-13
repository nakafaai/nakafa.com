# Backend scripts

These scripts verify production-owned state and prepare the isolated signed
content runtime used by agent-doc CI. Package scripts in
`packages/backend/package.json` are the command source of truth.

## Content ownership

Aksara is the authored source and signed publisher for article, material,
learning-program, Quran, and try-out content. Nakafa accepts verified signed
releases and owns learner state. There is no filesystem content sync or repair
CLI in Nakafa.

## Agent-doc runtime

`content-runtime/` exports and imports only the current signed publication
runtime for an isolated CI deployment. Its cache identity is bound to the
signed `contentState` generation and the exact schema fingerprint. Legacy route
and sitemap generations are not accepted as cache identity or reader input.

The GitHub agent-doc workflow invokes the package-owned `runtime:ci` command.
The command is an internal CI boundary, not a publication or repair surface.

## Customer verification

```sh
pnpm --filter @repo/backend customers:verify
pnpm --filter @repo/backend customers:verify:prod
```

These commands verify user, customer, and subscription cohesion without
changing content or customer state. `customers/` owns its Convex runtime and
environment boundary independently from content publication.
