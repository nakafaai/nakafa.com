import { afterEach, describe, expect, it } from "@effect/vitest";
import { agentTrustKeys } from "@repo/backend/keys";

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
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", undefined);
    vi.stubEnv("VERCEL_ENV", undefined);

    const keys = agentTrustKeys();

    expect(keys.AKSARA_AGENT_SIGNING_KEY_ID).toBeUndefined();
    expect(keys.AKSARA_AGENT_SIGNING_PUBLIC_KEY).toBeUndefined();
    expect(keys.CONVEX_CLOUD_URL).toBeUndefined();
    expect(keys.NEXT_PUBLIC_CONVEX_URL).toBeUndefined();
    expect(keys.VERCEL_ENV).toBeUndefined();
  });

  it("keeps every set value unchanged", () => {
    vi.stubEnv("AKSARA_AGENT_SIGNING_KEY_ID", "agent-key-id");
    vi.stubEnv("AKSARA_AGENT_SIGNING_PUBLIC_KEY", "agent-public-key");
    vi.stubEnv("CONVEX_CLOUD_URL", "https://example.convex.cloud");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VERCEL_ENV", "preview");

    expect(agentTrustKeys()).toStrictEqual({
      AKSARA_AGENT_SIGNING_KEY_ID: "agent-key-id",
      AKSARA_AGENT_SIGNING_PUBLIC_KEY: "agent-public-key",
      CONVEX_CLOUD_URL: "https://example.convex.cloud",
      NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
      VERCEL_ENV: "preview",
    });
  });

  it("keeps an empty public key, Convex URL and deployment environment as set values", () => {
    vi.stubEnv("AKSARA_AGENT_SIGNING_PUBLIC_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");
    vi.stubEnv("VERCEL_ENV", "");

    expect(agentTrustKeys()).toMatchObject({
      AKSARA_AGENT_SIGNING_PUBLIC_KEY: "",
      NEXT_PUBLIC_CONVEX_URL: "",
      VERCEL_ENV: "",
    });
  });
});
