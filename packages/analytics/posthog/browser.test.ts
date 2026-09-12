import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { BrowserAnalyticsIdentity } from "@repo/analytics/posthog/browser";
import { Deferred, Effect, Fiber, Ref } from "effect";
import type { CaptureResult } from "posthog-js";

const client = {
  capture: vi.fn(),
  captureException: vi.fn(),
  get_explicit_consent_status: vi.fn(),
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

function stubWindow(href = "https://nakafa.com/en") {
  vi.stubGlobal("window", {
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    location: { href },
    addEventListener: vi.fn(),
  });
}

const anonymousIdentity: BrowserAnalyticsIdentity = {
  consentDecidedAt: 100,
  consentMechanism: "privacy-controls",
  consentNoticeVersion: "privacy-2026-08-22",
  status: "anonymous",
};

const identifiedIdentity: BrowserAnalyticsIdentity = {
  consentDecidedAt: 100,
  consentMechanism: "privacy-controls",
  consentNoticeVersion: "privacy-2026-08-22",
  plan: "free",
  role: "student",
  status: "identified",
  userId: "user-1",
};

describe("two-tier PostHog browser runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
    client.get_property.mockReturnValue(undefined);
    client.get_explicit_consent_status.mockReturnValue("pending");
    stubWindow();
  });

  it.effect("drops capture calls until the baseline client loads", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();

      analytics.captureException(new Error("blocked"), {
        source: "pre-baseline-test",
      });
      analytics.resetBrowserAnalyticsIdentity();
      yield* analytics.revokeToBaselineAnalytics();

      expect(client.init).not.toHaveBeenCalled();
      expect(client.capture).not.toHaveBeenCalled();
      expect(client.captureException).not.toHaveBeenCalled();
      expect(client.opt_out_capturing).not.toHaveBeenCalled();
    })
  );

  it.effect("initializes the cookieless baseline without capturing yet", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();

      yield* analytics.enableBaselineAnalytics();

      expect(client.init).toHaveBeenCalledWith(
        "phc_test",
        expect.objectContaining({
          api_host: "/ingest",
          before_send: expect.any(Function),
          capture_pageview: false,
          cookieless_mode: "on_reject",
          disable_compression: true,
          opt_out_capturing_by_default: true,
          person_profiles: "identified_only",
          respect_dnt: true,
          save_campaign_params: true,
          save_referrer: true,
        })
      );
      expect(client.init.mock.calls[0]?.[1]).not.toHaveProperty(
        "property_denylist"
      );
      expect(client.capture).not.toHaveBeenCalled();
      expect(client.opt_in_capturing).not.toHaveBeenCalled();
      expect(client.opt_out_capturing).not.toHaveBeenCalled();
    })
  );

  it.effect("reuses an initialized baseline without capturing yet", () =>
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
      expect(client.capture).not.toHaveBeenCalled();
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

  it.effect("refuses admission before the baseline client loads", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();

      const failure = yield* analytics
        .admitConsentedIdentity(anonymousIdentity)
        .pipe(Effect.flip);

      expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
      expect(client.opt_in_capturing).not.toHaveBeenCalled();
    })
  );

  it.effect("admits a grant once without recounting the view", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });

      yield* analytics.admitConsentedIdentity(anonymousIdentity);
      yield* analytics.admitConsentedIdentity(anonymousIdentity);

      expect(client.opt_in_capturing).toHaveBeenCalledExactlyOnceWith({
        captureEventName: false,
      });
      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
      expect(client.register).toHaveBeenCalledWith({
        $geoip_disable: false,
        consent_decided_at: "1970-01-01T00:00:00.100Z",
        consent_decision: "granted",
        consent_mechanism: "privacy-controls",
        consent_notice_version: "privacy-2026-08-22",
        consent_scope: "anonymous",
      });
    })
  );

  it.effect("counts an intervening navigation instead of recounting it", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });

      window.location.href = "https://nakafa.com/id";
      window.history.pushState({}, "", "/id");
      yield* analytics.admitConsentedIdentity(anonymousIdentity);

      expect(client.opt_in_capturing).toHaveBeenCalledExactlyOnceWith({
        captureEventName: false,
      });
      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
    })
  );

  it.effect("routes automatic events through the live gate", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      const initConfig = client.init.mock.calls[0]?.[1];
      const probe: CaptureResult = {
        event: "$pageview",
        properties: { $current_url: "https://nakafa.com/en?q=x" },
        uuid: "019fa44c-02be-7cd0-a4ed-61a7af8e0620",
      };

      const minimized = initConfig?.before_send(probe);
      expect(minimized?.properties.$current_url).toBe("https://nakafa.com/en");
      expect(
        initConfig?.before_send({
          event: "$pageview",
          properties: { $user_id: "user-1" },
        })
      ).toBeNull();

      yield* analytics.admitConsentedIdentity(anonymousIdentity);
      const admitted: CaptureResult = {
        event: "$pageview",
        properties: {},
        uuid: "019fa44c-02be-7cd0-a4ed-61a7af8e0620",
      };
      expect(initConfig?.before_send(admitted)).toBe(admitted);
    })
  );

  it.effect("clears stale identity on anonymous admission", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      client.get_property.mockReturnValue("old-user");

      yield* analytics.admitConsentedIdentity(anonymousIdentity);

      expect(client.reset).toHaveBeenCalledExactlyOnceWith(false);
      expect(client.identify).not.toHaveBeenCalled();
    })
  );

  it.effect("updates person properties for the current user", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      client.get_property.mockReturnValue("user-1");

      yield* analytics.admitConsentedIdentity({
        ...identifiedIdentity,
        role: null,
      });

      expect(client.setPersonProperties).toHaveBeenCalledExactlyOnceWith({
        plan: "free",
      });
      expect(client.identify).not.toHaveBeenCalled();
    })
  );

  it.effect("identifies the resolved account on admission", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      client.get_property.mockReturnValue("other-user");

      yield* analytics.admitConsentedIdentity(identifiedIdentity);

      expect(client.identify).toHaveBeenCalledExactlyOnceWith("user-1", {
        plan: "free",
        role: "student",
      });
      expect(client.setPersonProperties).not.toHaveBeenCalled();
    })
  );

  it.effect("revokes a grant back to the baseline with one pageview", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      yield* analytics.admitConsentedIdentity(anonymousIdentity);

      yield* analytics.revokeToBaselineAnalytics();
      yield* analytics.revokeToBaselineAnalytics();

      expect(client.opt_out_capturing).toHaveBeenCalledOnce();
      expect(client.reset).toHaveBeenLastCalledWith(true);
      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
    })
  );

  it.effect("reconciles a persisted SDK opt-in without a gate grant", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      client.get_explicit_consent_status.mockReturnValue("granted");

      yield* analytics.revokeToBaselineAnalytics();

      expect(client.opt_out_capturing).toHaveBeenCalledOnce();
      expect(client.reset).toHaveBeenCalledExactlyOnceWith(true);
      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
    })
  );

  it.effect("revokes baseline callers without touching the SDK", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      analytics.suspendBrowserAnalyticsIdentity();

      yield* analytics.revokeToBaselineAnalytics();

      expect(client.opt_out_capturing).not.toHaveBeenCalled();
      expect(client.reset).not.toHaveBeenCalled();
      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
    })
  );

  it.effect("retries admission after a synchronization failure", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      client.register.mockImplementationOnce(() => {
        throw new Error("identity unavailable");
      });

      const failure = yield* analytics
        .admitConsentedIdentity(anonymousIdentity)
        .pipe(Effect.flip);

      expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
      expect(client.capture).not.toHaveBeenCalled();
      expect(client.opt_out_capturing).toHaveBeenCalledOnce();
      expect(client.reset).toHaveBeenCalledExactlyOnceWith(true);

      yield* analytics.admitConsentedIdentity(anonymousIdentity);

      expect(client.opt_in_capturing).toHaveBeenCalledTimes(2);
      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
    })
  );

  it.effect("surfaces revoke failure instead of stranding opt-in", () =>
    Effect.gen(function* () {
      const analytics = yield* loadBrowserAnalytics();
      yield* analytics.enableBaselineAnalytics({ load: loadClient });
      yield* analytics.admitConsentedIdentity(anonymousIdentity);
      client.opt_out_capturing.mockImplementationOnce(() => {
        throw new Error("opt-out unavailable");
      });

      const failure = yield* analytics
        .revokeToBaselineAnalytics()
        .pipe(Effect.flip);

      expect(failure).toBeInstanceOf(analytics.BrowserAnalyticsLoadFailed);
      expect(client.reset).not.toHaveBeenCalled();
      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");

      yield* analytics.revokeToBaselineAnalytics();

      expect(client.opt_out_capturing).toHaveBeenCalledTimes(2);
      expect(client.reset).toHaveBeenCalledExactlyOnceWith(true);
      expect(client.capture).toHaveBeenCalledExactlyOnceWith("$pageview");
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
