import {
  keys,
  postHogProxyKeys,
  postHogPublicKeys,
} from "@repo/analytics/keys";
import { afterEach, describe, expect, it, vi } from "vitest";

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
