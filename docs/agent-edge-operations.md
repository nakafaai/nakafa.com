# Agent interface rollout operations

Nakafa is introducing its Convex-owned REST and MCP interfaces through an
expand, switch, observe, contract rollout. The current pull request owns only
the additive expand phase.

## Current additive release

The deployed public transports remain unchanged:

- `api.nakafa.com` remains the existing Next.js API application.
- `mcp.nakafa.com/mcp` remains the SDK 1.30 Next.js MCP transport.
- `nakafa.com/mcp` remains the same-origin proxy for existing MCP clients.
- `apps/www` remains the only Vercel project that runs `convex deploy`.

The new Convex REST, OpenAPI, and MCP HTTP Actions are additive successors.
They are not connected to the canonical public hosts in this phase. Their
direct Convex origin requires the matching edge secret before any query or
tool work runs.

The independent secrets are:

- `NAKAFA_API_EDGE_SECRET`
- `NAKAFA_MCP_EDGE_SECRET`

`NAKAFA_MCP_ALLOWED_ORIGINS` is an optional comma-separated list of exact
browser origins for the Convex successor. Invalid configuration fails closed.
Server-to-server MCP clients may omit `Origin`.

## Local and isolated verification

Use the existing local transports for the deployed API and SDK 1.30 MCP
behavior:

```text
pnpm --filter api dev
pnpm --filter mcp dev
```

Exercise the additive Convex successor only through an isolated Convex Agent
Mode deployment. Configure inert test values for both edge secrets and pass
the matching header in the bounded verification request. Never put a secret in
source control, logs, screenshots, or shell history. Pull-request validation
must not create a Vercel Preview.

## Later edge switch

A separate protected change may connect the canonical API and MCP hosts to the
verified Convex successor through Vercel external rewrites. That change must:

1. Delete any caller-supplied edge-secret header before inserting the Vercel
   environment value.
2. Disable rewrite caching for API and MCP requests.
3. Preserve the SDK 1.30 transport contract for a bounded compatibility
   window, including the root `/mcp` alias and era-specific taxonomy.
4. Prove the route configuration locally, then verify the protected-main
   production deployment without a Preview.
5. Observe version-specific traffic until the named window shows zero legacy
   readers before removing compatibility in a cleanup change.

The switch is not part of the additive release. Vercel project deployments are
independent, so a change must never rely on one project finishing before
another project publishes the Convex successor.

## Secret rotation after the switch

The Convex guard accepts one current key or a comma-separated pair during a
zero-downtime rotation.

1. Generate a new key.
2. Configure Convex with `new-key,old-key` while Vercel still sends the old
   key.
3. Verify the canonical host and direct-origin rejection.
4. Replace the Vercel value with the new key through a protected-main release.
5. Verify the canonical contract and Vercel External Origins traffic.
6. Remove the old Convex key only after the new value is healthy.

## Rate-limit boundary

The official Convex rate-limiter component applies separate bounded limits to
the additive REST and MCP successors, including direct-origin traffic that
passes the secret guard. Convex-owned API failures use RFC 9457 Problem
Details. A later Vercel Firewall rule may reject a request before Convex, so a
platform-owned HTTP 429 is not guaranteed to use Nakafa Problem Details.
Clients must treat status 429 as authoritative, honor `Retry-After` when
present, and retry with backoff.
