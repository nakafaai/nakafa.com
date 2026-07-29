import { resetPersistedAnalyticsIdentity } from "@repo/analytics/posthog/identity";
import { initializeAnalytics } from "@repo/analytics/posthog/instrumentation-client";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/analytics/keys", () => ({
  keys: () => ({
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    NEXT_PUBLIC_POSTHOG_UI_HOST: "https://eu.posthog.com",
  }),
}));

vi.mock("@repo/analytics/posthog/config", () => ({
  POSTHOG_PROXY_PATH: "/ingest",
}));

vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
  },
}));

describe("PostHog browser instrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("installs the identified-event gate and pre-pageview reset", () => {
    initializeAnalytics();

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        api_host: "/ingest",
        before_send: expect.any(Function),
        loaded: resetPersistedAnalyticsIdentity,
      })
    );
  });
});
