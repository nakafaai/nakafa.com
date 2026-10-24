import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  convexKeys,
  convexSiteKeys,
  polarPublicKeys,
} from "@repo/backend/public";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Convex public keys", () => {
  it("decodes the Convex URLs and rejects missing or invalid values", () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://example.convex.site");

    expect(convexKeys()).toMatchObject({
      VITE_CONVEX_URL: "https://example.convex.cloud",
    });
    expect(convexSiteKeys()).toMatchObject({
      VITE_CONVEX_SITE_URL: "https://example.convex.site",
    });

    vi.stubEnv("VITE_CONVEX_URL", undefined);
    expect(convexKeys).toThrow();

    vi.stubEnv("VITE_CONVEX_SITE_URL", "not-a-url");
    expect(convexSiteKeys).toThrow();
  });
});

describe("Convex values at their boundaries", () => {
  it("keeps an empty Convex URL as a value, because it is only a required string", () => {
    vi.stubEnv("VITE_CONVEX_URL", "");

    expect(convexKeys()).toStrictEqual({ VITE_CONVEX_URL: "" });
  });

  it("throws when the Convex site URL is unset or empty", () => {
    vi.stubEnv("VITE_CONVEX_SITE_URL", undefined);
    expect(convexSiteKeys).toThrow();

    vi.stubEnv("VITE_CONVEX_SITE_URL", "");
    expect(convexSiteKeys).toThrow();
  });
});

describe("Polar public keys", () => {
  it("reads the Polar server of the browser build and keeps a missing value missing", () => {
    vi.stubEnv("VITE_POLAR_SERVER", "production");
    expect(polarPublicKeys()).toMatchObject({
      VITE_POLAR_SERVER: "production",
    });

    vi.stubEnv("VITE_POLAR_SERVER", undefined);
    expect(polarPublicKeys().VITE_POLAR_SERVER).toBeUndefined();
  });
});
