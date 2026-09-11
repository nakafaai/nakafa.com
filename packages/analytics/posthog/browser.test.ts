import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Ref } from "effect";

const client = {
  captureException: vi.fn(),
  get_property: vi.fn(),
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

const anonymousIdentity = {
  consentDecidedAt: 100,
  consentMechanism: "privacy-controls",
  consentNoticeVersion: "privacy-2026-08-22",
  status: "anonymous",
} as const;

describe("two-tier PostHog browser runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    client.get_property.mockReturnValue(undefined);
  });

  it.effect("drops capture calls until the baseline client loads", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();

      analytics.captureException(new Error("blocked"), {
        source: "pre-baseline-test",
      });
      analytics.resetBrowserAnalyticsIdentity();
      yield* analytics.downgradeToBaselineAnalytics();

      expect(client.init).not.toHaveBeenCalled();
      expect(client.captureException).not.toHaveBeenCalled();
      expect(client.opt_out_capturing).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "initializes the cookieless baseline without opting in or out",
    () =>
      Effect.gen(function* () {
        const analytics = yield* loadBrowserAnalytics();

        yield* analytics.enableBaselineAnalytics();

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
            capture_pageview: "history_change",
            cookieless_mode: "on_reject",
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
            rageclick: false,
            request_batching: false,
            respect_dnt: true,
            save_campaign_params: true,
            save_referrer: true,
          })
        );
        expect(client.init.mock.calls[0]?.[1]).not.toHaveProperty(
          "property_denylist"
        );
        expect(client.reset).not.toHaveBeenCalled();
        expect(client.opt_in_capturing).not.toHaveBeenCalled();
        expect(client.opt_out_capturing).not.toHaveBeenCalled();
      })
  );

  it.effect("reuses an initialized baseline without loading it again", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      const loadCount = yield* Ref.make(0);
      const load = Ref.update(loadCount, (count) => count + 1).pipe(
        Effect.as(client)
      );

      yield* analytics.enableBaselineAnalytics({ load });
      yield* analytics.enableBaselineAnalytics({ load });

      expect(yield* Ref.get(loadCount)).toBe(1);
      expect(client.init).toHaveBeenCalledOnce();
    })
  );

  it.effect("fails with the typed load error", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();

      const failure = yield* analytics
        .enableBaselineAnalytics({
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
        .enableBaselineAnalytics({ load: loadClient })
        .pipe(Effect.flip);

      expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
    })
  );

  it.effect("completes baseline init when suspended while the SDK loads", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      const loading = yield* Deferred.make<typeof client>();
      const started = yield* Deferred.make<void>();
      const load = Deferred.succeed(started, undefined).pipe(
        Effect.andThen(Deferred.await(loading))
      );
      const enabling = yield* Effect.forkChild(
        analytics.enableBaselineAnalytics({ load })
      );
      yield* Deferred.await(started);

      analytics.suspendBrowserAnalyticsIdentity();
      yield* Deferred.succeed(loading, client);
      yield* Fiber.join(enabling);

      expect(client.init).toHaveBeenCalledOnce();
      expect(client.opt_in_capturing).not.toHaveBeenCalled();
      expect(client.opt_out_capturing).not.toHaveBeenCalled();
    })
  );

  it.effect("refuses upgrades before the baseline client loads", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();

      const failure = yield* analytics
        .upgradeToConsentedAnalytics()
        .pipe(Effect.flip);

      expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
      expect(client.opt_in_capturing).not.toHaveBeenCalled();
    })
  );

  it.effect("upgrades once and ignores repeated grants", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });

      yield* analytics.upgradeToConsentedAnalytics();
      yield* analytics.upgradeToConsentedAnalytics();

      expect(client.opt_in_capturing).toHaveBeenCalledExactlyOnceWith({
        captureEventName: false,
      });
    })
  );

  it.effect("downgrades a granted client back to the baseline", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      yield* analytics.upgradeToConsentedAnalytics();

      yield* analytics.downgradeToBaselineAnalytics();

      expect(client.opt_out_capturing).toHaveBeenCalledOnce();
      expect(client.reset).toHaveBeenLastCalledWith(true);
    })
  );

  it.effect("downgrades baseline callers without touching SDK consent", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });

      yield* analytics.downgradeToBaselineAnalytics();

      expect(client.opt_out_capturing).not.toHaveBeenCalled();
      expect(client.reset).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "synchronizes anonymous and identified identities after a grant",
    () =>
      Effect.gen(function* () {
        const analytics = yield* loadBrowserAnalytics();
        yield* analytics.enableBaselineAnalytics({ load: loadClient });
        yield* analytics.upgradeToConsentedAnalytics();

        client.get_property.mockReturnValueOnce("old-user");
        yield* analytics.synchronizeBrowserAnalyticsIdentity(anonymousIdentity);

        client.get_property.mockReturnValueOnce(undefined);
        yield* analytics.synchronizeBrowserAnalyticsIdentity(anonymousIdentity);

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
          $geoip_disable: false,
          consent_decided_at: "1970-01-01T00:00:00.100Z",
          consent_decision: "granted",
          consent_mechanism: "privacy-controls",
          consent_notice_version: "privacy-2026-08-22",
          consent_scope: "account",
        });
      })
  );

  it.effect("ignores identity changes while on the baseline tier", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });

      yield* analytics.synchronizeBrowserAnalyticsIdentity(anonymousIdentity);
      analytics.resetBrowserAnalyticsIdentity();

      expect(client.get_property).not.toHaveBeenCalled();
      expect(client.identify).not.toHaveBeenCalled();
      expect(client.reset).toHaveBeenCalledExactlyOnceWith(false);
    })
  );

  it.effect(
    "fails closed when the SDK cannot synchronize consent identity",
    () =>
      Effect.gen(function* () {
        const analytics = yield* loadBrowserAnalytics();
        yield* analytics.enableBaselineAnalytics({ load: loadClient });
        yield* analytics.upgradeToConsentedAnalytics();
        client.register.mockImplementationOnce(() => {
          throw new Error("identity unavailable");
        });

        const failure = yield* analytics
          .synchronizeBrowserAnalyticsIdentity(anonymousIdentity)
          .pipe(Effect.flip);

        expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
      })
  );

  it.effect("captures scrubbed exceptions through the baseline", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });

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
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      const invalidProperties = {
        source: "browser-test",
        userId: "user-1",
      };

      analytics.captureException(new Error("blocked"), invalidProperties);

      expect(client.captureException).not.toHaveBeenCalled();
    })
  );
});
