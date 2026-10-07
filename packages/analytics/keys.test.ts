import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  deploymentKeys,
  keys,
  postHogProxyKeys,
  postHogPublicKeys,
} from "@repo/analytics/keys";

/** Installs one complete analytics environment for each assertion. */
function stubAnalyticsEnvironment() {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_UI_HOST", "https://eu.posthog.com");
  vi.stubEnv("POSTHOG_PROXY_HOST", "https://t.nakafa.com");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("analytics environment contracts", () => {
  it("decodes PostHog and server reporting values", () => {
    stubAnalyticsEnvironment();

    expect(postHogProxyKeys()).toEqual({
      POSTHOG_PROXY_HOST: "https://t.nakafa.com",
    });
    expect(postHogPublicKeys()).toEqual({
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
      NEXT_PUBLIC_POSTHOG_UI_HOST: "https://eu.posthog.com",
    });
    expect(keys()).toMatchObject({
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
      POSTHOG_PROXY_HOST: "https://t.nakafa.com",
    });
  });
});

describe("deployment keys for server reporting", () => {
  it("reads the deployment fields without the PostHog configuration", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", undefined);
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_UI_HOST", undefined);
    vi.stubEnv("POSTHOG_PROXY_HOST", undefined);

    expect(deploymentKeys()).toMatchObject({
      NEXT_PHASE: "phase-production-server",
      VERCEL_ENV: "production",
    });
  });

  it("accepts any deployment text and keeps absent fields undefined", () => {
    vi.stubEnv("VERCEL_ENV", "unknown-environment");
    vi.stubEnv("NEXT_PHASE", undefined);

    expect(deploymentKeys().VERCEL_ENV).toBe("unknown-environment");
    expect(deploymentKeys().NEXT_PHASE).toBeUndefined();
  });
});
