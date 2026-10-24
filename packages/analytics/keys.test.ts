import { afterEach, describe, expect, it } from "@effect/vitest";
import { deploymentKeys, keys, postHogProxyKeys } from "@repo/analytics/keys";

/** Installs one complete analytics environment for each assertion. */
function stubAnalyticsEnvironment() {
  vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
  vi.stubEnv("VITE_POSTHOG_UI_HOST", "https://eu.posthog.com");
  vi.stubEnv("VITE_POSTHOG_PROXY_HOST", "https://t.nakafa.com");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("analytics environment contracts", () => {
  it("decodes PostHog and server reporting values", () => {
    stubAnalyticsEnvironment();

    expect(postHogProxyKeys()).toEqual({
      VITE_POSTHOG_PROXY_HOST: "https://t.nakafa.com",
    });
    expect(keys()).toMatchObject({
      VITE_POSTHOG_KEY: "phc_test",
      VITE_POSTHOG_PROXY_HOST: "https://t.nakafa.com",
    });
  });
});

describe("deployment keys for server reporting", () => {
  it("reads the deployment fields without the PostHog configuration", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("TSS_PRERENDERING", "false");
    vi.stubEnv("VITE_POSTHOG_KEY", undefined);
    vi.stubEnv("VITE_POSTHOG_UI_HOST", undefined);
    vi.stubEnv("VITE_POSTHOG_PROXY_HOST", undefined);

    expect(deploymentKeys()).toMatchObject({
      TSS_PRERENDERING: "false",
      VERCEL_ENV: "production",
    });
  });

  it("accepts any deployment text and keeps absent fields undefined", () => {
    vi.stubEnv("VERCEL_ENV", "unknown-environment");
    vi.stubEnv("TSS_PRERENDERING", undefined);

    expect(deploymentKeys().VERCEL_ENV).toBe("unknown-environment");
    expect(deploymentKeys().TSS_PRERENDERING).toBeUndefined();
  });

  it("keeps an unset VERCEL_ENV undefined", () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("TSS_PRERENDERING", undefined);

    expect(deploymentKeys()).toStrictEqual({
      TSS_PRERENDERING: undefined,
      VERCEL_ENV: undefined,
    });
  });

  it("keeps empty deployment fields as set empty strings", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("TSS_PRERENDERING", "");

    expect(deploymentKeys()).toStrictEqual({
      TSS_PRERENDERING: "",
      VERCEL_ENV: "",
    });
  });
});

describe("required PostHog values", () => {
  it("requires a URL proxy host that is set, non-empty and parseable", () => {
    stubAnalyticsEnvironment();
    vi.stubEnv("VITE_POSTHOG_PROXY_HOST", undefined);
    expect(postHogProxyKeys).toThrow();

    vi.stubEnv("VITE_POSTHOG_PROXY_HOST", "");
    expect(postHogProxyKeys).toThrow();

    vi.stubEnv("VITE_POSTHOG_PROXY_HOST", "not a url");
    expect(postHogProxyKeys).toThrow();
  });

  it("throws from the merged analytics keys when any one value is invalid", () => {
    stubAnalyticsEnvironment();
    expect(keys).not.toThrow();

    vi.stubEnv("VITE_POSTHOG_PROXY_HOST", "");
    expect(keys).toThrow();

    stubAnalyticsEnvironment();
    vi.stubEnv("VITE_POSTHOG_UI_HOST", undefined);
    expect(keys).toThrow();
  });
});
