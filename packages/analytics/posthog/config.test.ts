import {
  createPostHogProxyRewrites,
  isPostHogProxyPathname,
} from "@repo/analytics/posthog/config";
import { describe, expect, it } from "vitest";

describe("PostHog proxy config", () => {
  it("builds the documented PostHog rewrite order", () => {
    expect(createPostHogProxyRewrites("https://t.nakafa.com")).toEqual([
      {
        source: "/_nakafa/static/:path*",
        destination: "https://t.nakafa.com/static/:path*",
      },
      {
        source: "/_nakafa/array/:path*",
        destination: "https://t.nakafa.com/array/:path*",
      },
      {
        source: "/_nakafa/:path*",
        destination: "https://t.nakafa.com/:path*",
      },
    ]);
  });

  it("matches only same-origin PostHog proxy requests", () => {
    expect(isPostHogProxyPathname("/_nakafa/flags")).toBe(true);
    expect(isPostHogProxyPathname("/en/_nakafa/flags")).toBe(false);
    expect(isPostHogProxyPathname("/search")).toBe(false);
  });
});
