declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

process.env.VITE_APP_URL ??= "https://nakafa.com";
/** Browser-safe Convex origins that `@/env.public` validates when a module loads. */
process.env.VITE_CONVEX_URL ??= "https://example.convex.cloud";
process.env.VITE_CONVEX_SITE_URL ??= "https://example.convex.site";
process.env.VITE_POSTHOG_PROXY_HOST ??= "https://t.nakafa.com";

/**
 * The Worker runtime module, which Node cannot resolve. A test that asserts the
 * request-time capture replaces `waitUntil` with its own double.
 */
vi.mock("cloudflare:workers", () => ({ waitUntil: () => undefined }));

/** Mark the Vitest jsdom environment as React act-aware. */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
