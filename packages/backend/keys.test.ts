import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  agentTrustKeys,
  convexKeys,
  convexSiteKeys,
  polarKeys,
} from "@repo/backend/keys";

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

describe("Agent Mode trust keys", () => {
  it("keeps a set value as set when it is empty", () => {
    vi.stubEnv("AKSARA_AGENT_SIGNING_KEY_ID", "");
    vi.stubEnv("CONVEX_CLOUD_URL", "");

    expect(agentTrustKeys()).toMatchObject({
      AKSARA_AGENT_SIGNING_KEY_ID: "",
      CONVEX_CLOUD_URL: "",
    });
  });

  it("leaves every absent value undefined", () => {
    vi.stubEnv("AKSARA_AGENT_SIGNING_KEY_ID", undefined);
    vi.stubEnv("AKSARA_AGENT_SIGNING_PUBLIC_KEY", undefined);
    vi.stubEnv("CONVEX_CLOUD_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", undefined);
    vi.stubEnv("VERCEL_ENV", undefined);

    const keys = agentTrustKeys();

    expect(keys.AKSARA_AGENT_SIGNING_KEY_ID).toBeUndefined();
    expect(keys.AKSARA_AGENT_SIGNING_PUBLIC_KEY).toBeUndefined();
    expect(keys.CONVEX_CLOUD_URL).toBeUndefined();
    expect(keys.NEXT_PUBLIC_CONVEX_URL).toBeUndefined();
    expect(keys.VERCEL_ENV).toBeUndefined();
  });
});
