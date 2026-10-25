---
"www": patch
"@repo/backend": patch
"@repo/analytics": patch
"@repo/design-system": patch
---

Dependencies move to their latest releases.

- `www`: @convex-dev/agent 0.7.8, the AI SDK 7.0.140. `www` reads its URL state through TanStack Router search params.
- `@repo/backend`: convex-helpers 0.1.129, @convex-dev/agent 0.7.8, the AI SDK 7.0.140, and posthog-node 5.55.1 for the PostHog component, which 5.56 and 5.57 cannot bundle for Convex.
- `@repo/analytics`: posthog-js 1.438.21, posthog-node 5.57.1.
- `@repo/design-system`: react-resizable-panels 4.14.8, react-aria-components 1.22.1, the AI SDK 7.0.140.

Development tools also move: the package manager moves from pnpm to Bun 1.4.4, vite 8.3.5, @playwright/test 1.64.1, @vercel/config 0.12.0, @scalar/openapi-parser 0.29.16.
