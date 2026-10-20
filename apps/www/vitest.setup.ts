declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

process.env.VITE_APP_URL ??= "https://nakafa.com";
/** Browser-safe Convex origins that `@/env.client` validates when a module loads. */
process.env.VITE_CONVEX_URL ??= "https://example.convex.cloud";
process.env.VITE_CONVEX_SITE_URL ??= "https://example.convex.site";

/** Mark the Vitest jsdom environment as React act-aware. */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
