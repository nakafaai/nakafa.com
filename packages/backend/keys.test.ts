import { afterEach, describe, expect, it } from "@effect/vitest";
import { convexKeys, convexSiteKeys, polarKeys } from "@repo/backend/keys";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Convex public keys", () => {
  it("decodes the Convex URLs and rejects missing or invalid values", () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://example.convex.site");

    expect(convexKeys()).toMatchObject({
      NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
    });
    expect(convexSiteKeys()).toMatchObject({
      NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site",
    });

    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", undefined);
    expect(convexKeys).toThrow();

    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "not-a-url");
    expect(convexSiteKeys).toThrow();
  });
});

describe("Polar server key", () => {
  it("leaves an absent server selection undefined", () => {
    vi.stubEnv("NEXT_PUBLIC_POLAR_SERVER", undefined);

    expect(polarKeys().NEXT_PUBLIC_POLAR_SERVER).toBeUndefined();
  });

  it("passes the server selection through without limiting it to known values", () => {
    vi.stubEnv("NEXT_PUBLIC_POLAR_SERVER", "unknown-server");

    expect(polarKeys().NEXT_PUBLIC_POLAR_SERVER).toBe("unknown-server");
  });
});
