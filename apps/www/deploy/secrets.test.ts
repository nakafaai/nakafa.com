// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { serverSecretNames } from "#www/deploy/secrets";

describe("serverSecretNames", () => {
  it("writes every set server value and the edge values once, and never a public value", () => {
    expect(
      serverSecretNames({
        AKSARA_PUBLICATION_TOKEN: "token",
        NAKAFA_CONVEX_SITE_URL: "https://example.convex.site",
        OPENWEATHER_API_KEY: undefined,
        VITE_CONVEX_URL: "https://example.convex.cloud",
      })
    ).toEqual([
      "AKSARA_PUBLICATION_TOKEN",
      "NAKAFA_CONVEX_SITE_URL",
      "NAKAFA_API_EDGE_SECRET",
      "NAKAFA_MCP_EDGE_SECRET",
    ]);
  });

  it("keeps the edge values even when the environment does not set them", () => {
    expect(serverSecretNames({})).toEqual([
      "NAKAFA_CONVEX_SITE_URL",
      "NAKAFA_API_EDGE_SECRET",
      "NAKAFA_MCP_EDGE_SECRET",
    ]);
  });
});
