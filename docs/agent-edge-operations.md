# Agent edge operations

Nakafa keeps the public REST API and MCP server behind Vercel external rewrites. Vercel deletes any caller-supplied edge-secret header, inserts the deployment secret, and forwards the request to the Convex HTTP Action. The Convex origin rejects a missing or incorrect value.

The API and MCP use independent secrets:

- `NAKAFA_API_EDGE_SECRET`
- `NAKAFA_MCP_EDGE_SECRET`

`NAKAFA_MCP_ALLOWED_ORIGINS` is an optional comma-separated list of exact
HTTPS browser origins. When it is absent, Nakafa accepts
`https://nakafa.com` and `https://www.nakafa.com`. Server-to-server MCP
clients may omit `Origin`.

## Production rollout ordering

The `www`, `api`, and `mcp` Vercel projects are independent deployments. Each
project therefore runs the repository-owned Convex production deploy as part
of its own production build. Convex runs the application build or MCP
typecheck first, pushes the exact backend only after that command succeeds,
and Vercel moves the project alias only after the complete build command
succeeds. An unsuccessful or racing backend push leaves the previous Vercel
alias active.

Set a production-scoped `CONVEX_DEPLOY_KEY` with `deployment:deploy`
permission in all three projects. Keep separate named keys per project so an
operator can revoke and audit one release path without affecting the others.
The repository disables every non-main Vercel Git deployment, so these keys
are never used for branch builds.

The MCP project stays edge-only in production. Its build command validates the
local Next.js adapter and deploys Convex, but Vercel publishes only the static
edge configuration from `apps/mcp/public`.

## Local development

The documented local commands remain available:

```text
pnpm --filter api dev
pnpm --filter mcp dev
```

Set `NAKAFA_CONVEX_SITE_URL` and the matching edge secret in each app's
`.env.local`. The route adapters forward to the selected isolated Convex
deployment when running locally. They fail closed when `VERCEL_ENV` is
`production`, where Vercel external rewrites own the public request path.

`https://nakafa.com/mcp` remains a same-origin compatibility rewrite to the
canonical MCP host. New clients should use `https://mcp.nakafa.com/mcp`
directly. The compatibility path adds one edge hop but preserves browser POST
and OPTIONS behavior without invoking a Next.js Function.

Use cryptographically random base64url or hexadecimal values without commas. Store values only in the matching Vercel project and Convex deployment. Never put a value in source control, logs, screenshots, or shell history.

## Zero-downtime rotation

Rotate API and MCP independently. The Convex environment accepts one current key or a comma-separated pair during rotation.

1. Generate a new key.
2. In Convex, set the relevant variable to `new-key,old-key`. Keep the Vercel project on the old key.
3. Verify the canonical host still succeeds through Vercel and direct origin requests without a key still return 403.
4. In the matching Vercel project, replace the old key with the new key and deploy the edge configuration.
5. Verify the canonical REST or MCP contract, direct origin rejection, and Vercel External Origins traffic.
6. In Convex, replace `new-key,old-key` with `new-key`.
7. Verify once more, then discard the old key from the operator's secure working material.

If the new Vercel configuration fails, restore the old Vercel value while Convex still accepts both keys. Do not remove the old Convex key until canonical traffic is healthy on the new value.

`/openapi.json` is intentionally public and does not use an edge secret.

## Rate-limit response boundary

Convex-owned API failures use RFC 9457 Problem Details. A Vercel Firewall
rule can stop a request before it reaches Convex, so its HTTP 429 response is
owned by Vercel and is not guaranteed to use Nakafa's Problem Details schema.
Clients must treat the status code as authoritative, honor `Retry-After` when
present, and retry with backoff.
