import { afterEach, describe, expect, it } from "@effect/vitest";
import { postHogPublicKeys } from "@repo/analytics/public";

/** Installs the public PostHog values for each assertion. */
function stubAnalyticsEnvironment() {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_UI_HOST", "https://eu.posthog.com");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public PostHog values", () => {
  it("decodes the project key and the UI host", () => {
    stubAnalyticsEnvironment();

    expect(postHogPublicKeys()).toEqual({
      NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
      NEXT_PUBLIC_POSTHOG_UI_HOST: "https://eu.posthog.com",
    });
  });

  it("requires a project key with the phc_ prefix", () => {
    stubAnalyticsEnvironment();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", undefined);
    expect(postHogPublicKeys).toThrow();

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    expect(postHogPublicKeys).toThrow();

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "ph_test");
    expect(postHogPublicKeys).toThrow();
  });

  it("requires a URL UI host that is set and parseable", () => {
    stubAnalyticsEnvironment();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_UI_HOST", undefined);
    expect(postHogPublicKeys).toThrow();

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_UI_HOST", "");
    expect(postHogPublicKeys).toThrow();

    vi.stubEnv("NEXT_PUBLIC_POSTHOG_UI_HOST", "not a url");
    expect(postHogPublicKeys).toThrow();
  });
});
