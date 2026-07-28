import {
  initializeAnalytics,
  resetPersistedAnalyticsIdentity,
} from "@repo/analytics/posthog/instrumentation-client";
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

  it("replaces a persisted user while preserving capture consent", () => {
    const optedOutClient = {
      get_property: vi.fn(() => "deleted-user"),
      has_opted_out_capturing: vi.fn(() => true),
      opt_out_capturing: vi.fn(),
      reset: vi.fn(),
    };

    resetPersistedAnalyticsIdentity(optedOutClient);

    expect(optedOutClient.reset).toHaveBeenCalledOnce();
    expect(optedOutClient.opt_out_capturing).toHaveBeenCalledOnce();
  });

  it("replaces a persisted user without adding an opt-out", () => {
    const capturingClient = {
      get_property: vi.fn(() => "deleted-user"),
      has_opted_out_capturing: vi.fn(() => false),
      opt_out_capturing: vi.fn(),
      reset: vi.fn(),
    };

    resetPersistedAnalyticsIdentity(capturingClient);

    expect(capturingClient.reset).toHaveBeenCalledOnce();
    expect(capturingClient.opt_out_capturing).not.toHaveBeenCalled();
  });

  it("leaves an anonymous browser identity intact", () => {
    const anonymousClient = {
      get_property: vi.fn(() => undefined),
      has_opted_out_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
      reset: vi.fn(),
    };

    resetPersistedAnalyticsIdentity(anonymousClient);

    expect(anonymousClient.reset).not.toHaveBeenCalled();
    expect(anonymousClient.opt_out_capturing).not.toHaveBeenCalled();
  });
});
