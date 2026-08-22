import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const client = {
  captureException: vi.fn(),
  get_property: vi.fn(),
  has_opted_out_capturing: vi.fn(() => false),
  identify: vi.fn(),
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  register: vi.fn(),
  reset: vi.fn(),
  setPersonProperties: vi.fn(),
};

vi.mock("@repo/analytics/keys", () => ({
  keys: () => ({
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    NEXT_PUBLIC_POSTHOG_UI_HOST: "https://eu.posthog.com",
  }),
}));

vi.mock("@repo/analytics/posthog/config", () => ({
  POSTHOG_PROXY_PATH: "/ingest",
}));

vi.mock("posthog-js", () => ({ default: client }));

describe("consent-aware PostHog browser runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    client.get_property.mockReturnValue(undefined);
    client.has_opted_out_capturing.mockReturnValue(false);
  });

  it("does not load PostHog for capture calls before consent", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");

    analytics.captureException(new Error("blocked"), {
      source: "pre-consent-test",
    });
    await Effect.runPromise(analytics.disableBrowserAnalytics());

    expect(client.init).not.toHaveBeenCalled();
    expect(client.captureException).not.toHaveBeenCalled();
  });

  it("initializes opted out, clears old state, then explicitly opts in", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");

    await Effect.runPromise(analytics.enableBrowserAnalytics());

    expect(client.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        advanced_disable_flags: true,
        api_host: "/ingest",
        autocapture: false,
        before_send: expect.any(Function),
        capture_dead_clicks: false,
        capture_exceptions: false,
        capture_heatmaps: false,
        capture_pageleave: false,
        capture_performance: false,
        capture_pageview: false,
        disable_conversations: true,
        disableDeviceModel: true,
        disable_external_dependency_loading: true,
        disable_product_tours: true,
        disable_session_recording: true,
        disable_surveys: true,
        disable_web_experiments: true,
        enable_recording_console_log: false,
        mask_all_element_attributes: true,
        mask_all_text: true,
        opt_out_capturing_by_default: true,
        opt_out_persistence_by_default: true,
        persistence: "localStorage",
        person_profiles: "identified_only",
        property_denylist: [
          "$browser",
          "$browser_language",
          "$browser_language_prefix",
          "$browser_version",
          "$current_url",
          "$device",
          "$device_model",
          "$device_type",
          "$host",
          "$initialization_time",
          "$os",
          "$os_version",
          "$pathname",
          "$raw_user_agent",
          "$referrer",
          "$referring_domain",
          "$screen_height",
          "$screen_width",
          "$session_id",
          "$timezone",
          "$timezone_offset",
          "$viewport_height",
          "$viewport_width",
          "$window_id",
        ],
        rageclick: false,
        request_batching: false,
        respect_dnt: true,
        save_campaign_params: false,
        save_referrer: false,
      })
    );
    expect(client.reset).toHaveBeenCalledExactlyOnceWith(true);
    expect(client.opt_in_capturing).toHaveBeenCalledExactlyOnceWith({
      captureEventName: false,
    });
  });

  it("reuses an initialized client without loading it again", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");
    const load = vi.fn(async () => client);

    await Effect.runPromise(analytics.enableBrowserAnalytics({ load }));
    await Effect.runPromise(analytics.enableBrowserAnalytics({ load }));

    expect(load).toHaveBeenCalledOnce();
    expect(client.opt_in_capturing).toHaveBeenCalledTimes(2);
  });

  it("fails with the typed load error", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");

    const failure = await Effect.runPromise(
      analytics
        .enableBrowserAnalytics({
          load: () => Promise.reject(new Error("network unavailable")),
        })
        .pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
  });

  it("fails with the typed initialization error", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");
    client.init.mockImplementationOnce(() => {
      throw new Error("initialization unavailable");
    });

    const failure = await Effect.runPromise(
      analytics
        .enableBrowserAnalytics({ load: async () => client })
        .pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
  });

  it("disables a loaded client and clears its persisted identity", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");
    await Effect.runPromise(
      analytics.enableBrowserAnalytics({ load: async () => client })
    );

    await Effect.runPromise(analytics.disableBrowserAnalytics());
    await Effect.runPromise(
      analytics.synchronizeBrowserAnalyticsIdentity({
        consentDecidedAt: 100,
        consentMechanism: "privacy-controls",
        consentNoticeVersion: "privacy-2026-08-22",
        status: "anonymous",
      })
    );
    analytics.captureException(new Error("blocked"), {
      source: "disabled-test",
    });

    expect(client.reset).toHaveBeenLastCalledWith(true);
    expect(client.opt_out_capturing).toHaveBeenCalledOnce();
    expect(client.captureException).not.toHaveBeenCalled();
  });

  it("stops an enable request withdrawn while the SDK loads", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");
    let resolveClient: ((value: typeof client) => void) | undefined;
    const load = new Promise<typeof client>((resolve) => {
      resolveClient = resolve;
    });
    const enabling = Effect.runPromise(
      analytics.enableBrowserAnalytics({ load: () => load })
    );

    await Effect.runPromise(analytics.disableBrowserAnalytics());
    resolveClient?.(client);
    await enabling;

    expect(client.opt_in_capturing).not.toHaveBeenCalled();
    expect(client.opt_out_capturing).toHaveBeenCalledOnce();
  });

  it("synchronizes anonymous and identified identities after consent", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");
    await Effect.runPromise(
      analytics.enableBrowserAnalytics({ load: async () => client })
    );

    client.get_property.mockReturnValueOnce("old-user");
    await Effect.runPromise(
      analytics.synchronizeBrowserAnalyticsIdentity({
        consentDecidedAt: 100,
        consentMechanism: "privacy-controls",
        consentNoticeVersion: "privacy-2026-08-22",
        status: "anonymous",
      })
    );

    client.get_property.mockReturnValueOnce(undefined);
    await Effect.runPromise(
      analytics.synchronizeBrowserAnalyticsIdentity({
        consentDecidedAt: 100,
        consentMechanism: "privacy-controls",
        consentNoticeVersion: "privacy-2026-08-22",
        status: "anonymous",
      })
    );

    client.get_property.mockReturnValueOnce("other-user");
    await Effect.runPromise(
      analytics.synchronizeBrowserAnalyticsIdentity({
        consentDecidedAt: 100,
        consentMechanism: "privacy-controls",
        consentNoticeVersion: "privacy-2026-08-22",
        plan: "free",
        role: "student",
        status: "identified",
        userId: "user-1",
      })
    );

    client.get_property.mockReturnValueOnce("user-1");
    await Effect.runPromise(
      analytics.synchronizeBrowserAnalyticsIdentity({
        consentDecidedAt: 100,
        consentMechanism: "privacy-controls",
        consentNoticeVersion: "privacy-2026-08-22",
        plan: "free",
        role: null,
        status: "identified",
        userId: "user-1",
      })
    );

    expect(client.identify).toHaveBeenCalledOnce();
    expect(client.setPersonProperties).toHaveBeenCalledOnce();
    expect(client.register).toHaveBeenCalledWith({
      $geoip_disable: true,
      consent_decided_at: "1970-01-01T00:00:00.100Z",
      consent_decision: "granted",
      consent_mechanism: "privacy-controls",
      consent_notice_version: "privacy-2026-08-22",
      consent_scope: "account",
    });
  });

  it("keeps capture dormant when identity changes before consent", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");

    await Effect.runPromise(
      analytics.synchronizeBrowserAnalyticsIdentity({
        consentDecidedAt: 100,
        consentMechanism: "privacy-controls",
        consentNoticeVersion: "privacy-2026-08-22",
        status: "anonymous",
      })
    );
    analytics.resetBrowserAnalyticsIdentity();

    expect(client.get_property).not.toHaveBeenCalled();
    expect(client.reset).not.toHaveBeenCalled();
  });

  it("fails closed when the SDK cannot synchronize consent identity", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");
    await Effect.runPromise(
      analytics.enableBrowserAnalytics({ load: async () => client })
    );
    client.register.mockImplementationOnce(() => {
      throw new Error("identity unavailable");
    });

    const failure = await Effect.runPromise(
      analytics
        .synchronizeBrowserAnalyticsIdentity({
          consentDecidedAt: 100,
          consentMechanism: "privacy-controls",
          consentNoticeVersion: "privacy-2026-08-22",
          status: "anonymous",
        })
        .pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
    expect(client.reset).toHaveBeenLastCalledWith(true);
    expect(client.opt_out_capturing).toHaveBeenCalledOnce();
  });

  it("captures through an enabled client and resets its identity", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");
    await Effect.runPromise(
      analytics.enableBrowserAnalytics({ load: async () => client })
    );

    analytics.captureException(new Error("handled user@example.com"), {
      source: "browser-test",
    });
    analytics.resetBrowserAnalyticsIdentity(true);

    expect(client.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Operational exception",
        name: "OperationalError",
      }),
      { source: "browser-test" }
    );
    expect(JSON.stringify(client.captureException.mock.calls)).not.toContain(
      "user@example.com"
    );
    expect(client.reset).toHaveBeenLastCalledWith(true);
  });

  it("drops runtime context outside the exact privacy contract", async () => {
    const analytics = await import("@repo/analytics/posthog/browser");
    await Effect.runPromise(
      analytics.enableBrowserAnalytics({ load: async () => client })
    );

    Reflect.apply(analytics.captureException, undefined, [
      new Error("blocked"),
      { source: "browser-test", userId: "user-1" },
    ]);

    expect(client.captureException).not.toHaveBeenCalled();
  });
});
