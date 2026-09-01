import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Ref } from "effect";

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

/** Loads a fresh browser analytics module after Vitest resets its state. */
const loadBrowserAnalytics = () =>
  Effect.promise(() => import("@repo/analytics/posthog/browser"));

/** Resolves the test-owned PostHog client through the production loader seam. */
const loadClient = Effect.succeed(client);

describe("consent-aware PostHog browser runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    client.get_property.mockReturnValue(undefined);
    client.has_opted_out_capturing.mockReturnValue(false);
  });

  it.effect("does not load PostHog for capture calls before consent", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();

      analytics.captureException(new Error("blocked"), {
        source: "pre-consent-test",
      });
      yield* analytics.disableBrowserAnalytics();

      expect(client.init).not.toHaveBeenCalled();
      expect(client.captureException).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "initializes opted out, clears old state, then explicitly opts in",
    () =>
      Effect.gen(function* () {
        const analytics = yield* loadBrowserAnalytics();

        yield* analytics.enableBrowserAnalytics();

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
      })
  );

  it.effect("reuses an initialized client without loading it again", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      const loadCount = yield* Ref.make(0);
      const load = Ref.update(loadCount, (count) => count + 1).pipe(
        Effect.as(client)
      );

      yield* analytics.enableBrowserAnalytics({ load });
      yield* analytics.enableBrowserAnalytics({ load });

      expect(yield* Ref.get(loadCount)).toBe(1);
      expect(client.opt_in_capturing).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("fails with the typed load error", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();

      const failure = yield* analytics
        .enableBrowserAnalytics({
          load: Effect.fail("network unavailable"),
        })
        .pipe(Effect.flip);

      expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
    })
  );

  it.effect("fails with the typed initialization error", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      client.init.mockImplementationOnce(() => {
        throw new Error("initialization unavailable");
      });

      const failure = yield* analytics
        .enableBrowserAnalytics({ load: loadClient })
        .pipe(Effect.flip);

      expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
    })
  );

  it.effect("disables a loaded client and clears its persisted identity", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBrowserAnalytics({ load: loadClient });

      yield* analytics.disableBrowserAnalytics();
      yield* analytics.synchronizeBrowserAnalyticsIdentity({
        consentDecidedAt: 100,
        consentMechanism: "privacy-controls",
        consentNoticeVersion: "privacy-2026-08-22",
        status: "anonymous",
      });
      analytics.captureException(new Error("blocked"), {
        source: "disabled-test",
      });

      expect(client.reset).toHaveBeenLastCalledWith(true);
      expect(client.opt_out_capturing).toHaveBeenCalledOnce();
      const optOutOrder =
        client.opt_out_capturing.mock.invocationCallOrder[0] ?? 0;
      const resetOrder = client.reset.mock.invocationCallOrder.at(-1) ?? 0;
      expect(optOutOrder).toBeLessThan(resetOrder);
      expect(client.captureException).not.toHaveBeenCalled();
    })
  );

  it.effect("stops an enable request withdrawn while the SDK loads", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      const loading = yield* Deferred.make<typeof client>();
      const started = yield* Deferred.make<void>();
      const load = Deferred.succeed(started, undefined).pipe(
        Effect.andThen(Deferred.await(loading))
      );
      const enabling = yield* Effect.forkChild(
        analytics.enableBrowserAnalytics({ load })
      );
      yield* Deferred.await(started);

      yield* analytics.disableBrowserAnalytics();
      yield* Deferred.succeed(loading, client);
      yield* Fiber.join(enabling);

      expect(client.opt_in_capturing).not.toHaveBeenCalled();
      expect(client.opt_out_capturing).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "synchronizes anonymous and identified identities after consent",
    () =>
      Effect.gen(function* () {
        const analytics = yield* loadBrowserAnalytics();
        yield* analytics.enableBrowserAnalytics({ load: loadClient });

        client.get_property.mockReturnValueOnce("old-user");
        yield* analytics.synchronizeBrowserAnalyticsIdentity({
          consentDecidedAt: 100,
          consentMechanism: "privacy-controls",
          consentNoticeVersion: "privacy-2026-08-22",
          status: "anonymous",
        });

        client.get_property.mockReturnValueOnce(undefined);
        yield* analytics.synchronizeBrowserAnalyticsIdentity({
          consentDecidedAt: 100,
          consentMechanism: "privacy-controls",
          consentNoticeVersion: "privacy-2026-08-22",
          status: "anonymous",
        });

        client.get_property.mockReturnValueOnce("other-user");
        yield* analytics.synchronizeBrowserAnalyticsIdentity({
          consentDecidedAt: 100,
          consentMechanism: "privacy-controls",
          consentNoticeVersion: "privacy-2026-08-22",
          plan: "free",
          role: "student",
          status: "identified",
          userId: "user-1",
        });

        client.get_property.mockReturnValueOnce("user-1");
        yield* analytics.synchronizeBrowserAnalyticsIdentity({
          consentDecidedAt: 100,
          consentMechanism: "privacy-controls",
          consentNoticeVersion: "privacy-2026-08-22",
          plan: "free",
          role: null,
          status: "identified",
          userId: "user-1",
        });

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
      })
  );

  it.effect("keeps capture dormant when identity changes before consent", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();

      yield* analytics.synchronizeBrowserAnalyticsIdentity({
        consentDecidedAt: 100,
        consentMechanism: "privacy-controls",
        consentNoticeVersion: "privacy-2026-08-22",
        status: "anonymous",
      });
      analytics.resetBrowserAnalyticsIdentity();

      expect(client.get_property).not.toHaveBeenCalled();
      expect(client.reset).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "fails closed when the SDK cannot synchronize consent identity",
    () =>
      Effect.gen(function* () {
        const analytics = yield* loadBrowserAnalytics();
        yield* analytics.enableBrowserAnalytics({ load: loadClient });
        client.register.mockImplementationOnce(() => {
          throw new Error("identity unavailable");
        });

        const failure = yield* analytics
          .synchronizeBrowserAnalyticsIdentity({
            consentDecidedAt: 100,
            consentMechanism: "privacy-controls",
            consentNoticeVersion: "privacy-2026-08-22",
            status: "anonymous",
          })
          .pipe(Effect.flip);

        expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
        expect(client.reset).toHaveBeenLastCalledWith(true);
        expect(client.opt_out_capturing).toHaveBeenCalledOnce();
      })
  );

  it.effect("captures through an enabled client and resets its identity", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBrowserAnalytics({ load: loadClient });

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
    })
  );

  it.effect("drops runtime context outside the exact privacy contract", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBrowserAnalytics({ load: loadClient });
      const invalidProperties = {
        source: "browser-test",
        userId: "user-1",
      };

      analytics.captureException(new Error("blocked"), invalidProperties);

      expect(client.captureException).not.toHaveBeenCalled();
    })
  );
});
