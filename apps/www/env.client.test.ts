// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";

/** Gives the public Convex values that every browser entry point requires. */
function stubPublicConvex() {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://example.convex.site");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("browser environment", () => {
  it("passes the public Convex URLs through", async () => {
    stubPublicConvex();

    const { clientEnv } = await import("@/env.client");

    expect(clientEnv.NEXT_PUBLIC_CONVEX_URL).toBe(
      "https://example.convex.cloud"
    );
    expect(clientEnv.NEXT_PUBLIC_CONVEX_SITE_URL).toBe(
      "https://example.convex.site"
    );
  });

  it("keeps an unset preview flag undefined", async () => {
    stubPublicConvex();
    vi.stubEnv("NEXT_PUBLIC_AKSARA_PREVIEW_CHILD", undefined);

    const { clientEnv } = await import("@/env.client");

    expect(clientEnv.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD).toBeUndefined();
  });

  it("accepts only the literal preview flags and names the variable otherwise", async () => {
    stubPublicConvex();
    vi.stubEnv("NEXT_PUBLIC_AKSARA_PREVIEW_CHILD", "true");
    const { clientEnv } = await import("@/env.client");
    expect(clientEnv.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD).toBe("true");

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AKSARA_PREVIEW_CHILD", "yes");
    await expect(import("@/env.client")).rejects.toThrow(
      "NEXT_PUBLIC_AKSARA_PREVIEW_CHILD"
    );
  });
});
