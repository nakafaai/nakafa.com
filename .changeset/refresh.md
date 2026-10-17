---
"www": patch
"@repo/backend": patch
"@repo/analytics": patch
"@repo/design-system": patch
---

Dependencies move to their latest releases. No application code changes.

- `www`: nuqs 2.10.2, @convex-dev/agent 0.7.8, the AI SDK 7.0.140.
- `@repo/backend`: convex-helpers 0.1.128, @convex-dev/agent 0.7.8, the AI SDK 7.0.140, and posthog-node 5.55.1 for the PostHog component, which 5.56 cannot bundle for Convex.
- `@repo/analytics`: posthog-js 1.438.12, posthog-node 5.56.2.
- `@repo/design-system`: react-resizable-panels 4.14.5, react-aria-components 1.22.1, the AI SDK 7.0.140.

Development tools also move: pnpm 11.28.5, vite 8.3.4, @playwright/test 1.64.1, @vercel/config 0.12.0, @scalar/openapi-parser 0.29.14.
