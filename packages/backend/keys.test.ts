import { afterEach, describe, expect, it } from "@effect/vitest";
import { agentTrustKeys, convexSiteServerKeys } from "@repo/backend/keys";

afterEach(() => {
  vi.unstubAllEnvs();
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
    vi.stubEnv("VITE_CONVEX_URL", undefined);
    vi.stubEnv("NAKAFA_DEPLOY_STAGE", undefined);

    const keys = agentTrustKeys();

    expect(keys.AKSARA_AGENT_SIGNING_KEY_ID).toBeUndefined();
    expect(keys.AKSARA_AGENT_SIGNING_PUBLIC_KEY).toBeUndefined();
    expect(keys.CONVEX_CLOUD_URL).toBeUndefined();
    expect(keys.VITE_CONVEX_URL).toBeUndefined();
    expect(keys.NAKAFA_DEPLOY_STAGE).toBeUndefined();
  });

  it("keeps every set value unchanged", () => {
    vi.stubEnv("AKSARA_AGENT_SIGNING_KEY_ID", "agent-key-id");
    vi.stubEnv("AKSARA_AGENT_SIGNING_PUBLIC_KEY", "agent-public-key");
    vi.stubEnv("CONVEX_CLOUD_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("NAKAFA_DEPLOY_STAGE", "staging");

    expect(agentTrustKeys()).toStrictEqual({
      AKSARA_AGENT_SIGNING_KEY_ID: "agent-key-id",
      AKSARA_AGENT_SIGNING_PUBLIC_KEY: "agent-public-key",
      CONVEX_CLOUD_URL: "https://example.convex.cloud",
      VITE_CONVEX_URL: "https://example.convex.cloud",
      NAKAFA_DEPLOY_STAGE: "staging",
    });
  });

  it("keeps an empty public key, Convex URL and deployment environment as set values", () => {
    vi.stubEnv("AKSARA_AGENT_SIGNING_PUBLIC_KEY", "");
    vi.stubEnv("VITE_CONVEX_URL", "");
    vi.stubEnv("NAKAFA_DEPLOY_STAGE", "");

    expect(agentTrustKeys()).toMatchObject({
      AKSARA_AGENT_SIGNING_PUBLIC_KEY: "",
      VITE_CONVEX_URL: "",
      NAKAFA_DEPLOY_STAGE: "",
    });
  });
});

describe("Convex site server key", () => {
  it("passes the site address through for the server calls", () => {
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://example.convex.site");

    expect(convexSiteServerKeys()).toStrictEqual({
      VITE_CONVEX_SITE_URL: "https://example.convex.site",
    });
  });

  it("refuses an address that is not a URL", () => {
    vi.stubEnv("VITE_CONVEX_SITE_URL", "not a url");

    expect(() => convexSiteServerKeys()).toThrow();
  });
});
