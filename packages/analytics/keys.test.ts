import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  keys,
  postHogProxyKeys,
  postHogPublicKeys,
  postHogSourceMapKeys,
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

  it("reads source map credentials only when both are present", () => {
    vi.stubEnv("POSTHOG_API_KEY", "phx_source_map");
    vi.stubEnv("POSTHOG_PROJECT_ID", "114144");

    expect(postHogSourceMapKeys()).toEqual({
      POSTHOG_API_KEY: "phx_source_map",
      POSTHOG_PROJECT_ID: "114144",
    });
  });

  it("leaves source map credentials undefined outside production", () => {
    vi.stubEnv("POSTHOG_API_KEY", undefined);
    vi.stubEnv("POSTHOG_PROJECT_ID", undefined);

    expect(postHogSourceMapKeys()).toEqual({
      POSTHOG_API_KEY: undefined,
      POSTHOG_PROJECT_ID: undefined,
    });
  });
});
