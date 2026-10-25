// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";

/** Gives the public Convex values that every browser entry point requires. */
function stubPublicConvex() {
  vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
  vi.stubEnv("VITE_CONVEX_SITE_URL", "https://example.convex.site");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("browser environment", () => {
  it("holds exactly the public values, with an unset preview flag undefined", async () => {
    stubPublicConvex();
    vi.stubEnv("VITE_AKSARA_PREVIEW_CHILD", undefined);

    const { clientEnv } = await import("@/env.public");

    expect(clientEnv).toStrictEqual({
      VITE_AKSARA_PREVIEW_CHILD: undefined,
      VITE_CONVEX_SITE_URL: "https://example.convex.site",
      VITE_CONVEX_URL: "https://example.convex.cloud",
    });
  });

  it("accepts only the literal preview flags and names the variable otherwise", async () => {
    stubPublicConvex();
    for (const flag of ["true", "false"]) {
      vi.resetModules();
      vi.stubEnv("VITE_AKSARA_PREVIEW_CHILD", flag);
      const { clientEnv } = await import("@/env.public");
      expect(clientEnv.VITE_AKSARA_PREVIEW_CHILD).toBe(flag);
    }

    for (const flag of ["yes", ""]) {
      vi.resetModules();
      vi.stubEnv("VITE_AKSARA_PREVIEW_CHILD", flag);
      await expect(import("@/env.public")).rejects.toThrow(
        "VITE_AKSARA_PREVIEW_CHILD"
      );
    }
  });
});
