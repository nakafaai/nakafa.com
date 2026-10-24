import {
  type AnalyticsConsentScope,
  AnonymousAnalyticsConsentDecidedAtSchema,
  CONSENT_DECISION_MECHANISMS,
  CONSENT_NOTICE_VERSIONS,
} from "@repo/analytics/consent";
import {
  type BrowserAnalyticsClient,
  publishAnalyticsClient,
  readAnalyticsClient,
} from "@repo/analytics/posthog/capture";
import {
  type AnalyticsIdentityAuthorization,
  type AnalyticsTier,
  filterAuthorizedAnalyticsEvent,
} from "@repo/analytics/posthog/identity";
import {
  PageviewWindow,
  startPageviewTracking,
} from "@repo/analytics/posthog/pageview";
import { postHogPublicKeys } from "@repo/analytics/public";
import { DateTime, Effect, MutableRef, Schema } from "effect";

/** Consent provenance that every granted browser event carries into PostHog. */
const BrowserAnalyticsConsentProvenanceFields = {
  consentDecidedAt: AnonymousAnalyticsConsentDecidedAtSchema,
  consentMechanism: Schema.Literals(CONSENT_DECISION_MECHANISMS),
  consentNoticeVersion: Schema.Literals(CONSENT_NOTICE_VERSIONS),
};

const BrowserAnalyticsIdentitySchema = Schema.Union([
  Schema.Struct({
    ...BrowserAnalyticsConsentProvenanceFields,
    status: Schema.Literal("anonymous"),
  }),
  Schema.Struct({
    ...BrowserAnalyticsConsentProvenanceFields,
    plan: Schema.String,
    role: Schema.NullOr(Schema.String),
    status: Schema.Literal("identified"),
    userId: Schema.String,
  }),
]);

export type BrowserAnalyticsIdentity =
  typeof BrowserAnalyticsIdentitySchema.Type;

const browserAnalyticsLoadFailedCode = "BROWSER_ANALYTICS_LOAD_FAILED";
const analyticsTier = MutableRef.make<AnalyticsTier>("baseline");
const identityAuthorization = MutableRef.make<AnalyticsIdentityAuthorization>({
  status: "unresolved",
});
/** Fires the deferred landing view once: the first counted view consumes it. */
const initialPageviewCaptured = MutableRef.make(false);

/** Raised when the baseline client cannot initialize or upgrade. */
export class BrowserAnalyticsLoadFailed extends Schema.TaggedError<BrowserAnalyticsLoadFailed>()(
  "BrowserAnalyticsLoadFailed",
  { code: Schema.Literal(browserAnalyticsLoadFailedCode) }
) {}

const browserAnalyticsLoadFailure = () =>
  new BrowserAnalyticsLoadFailed({ code: browserAnalyticsLoadFailedCode });

/** Loads the PostHog browser SDK that the baseline client is built on. */
const loadBrowserAnalyticsSdk: Effect.Effect<
  BrowserAnalyticsClient,
  BrowserAnalyticsLoadFailed
> = Effect.tryPromise({
  try: () => import("posthog-js"),
  catch: browserAnalyticsLoadFailure,
}).pipe(Effect.map((module) => module.default));

/** Returns the gate to baseline and revokes identity without SDK calls. */
function revokeGate() {
  MutableRef.set(analyticsTier, "baseline");
  MutableRef.set(identityAuthorization, { status: "unresolved" });
}

/** Returns one client to baseline capture without admitting new identity. */
const restoreBaselineSdk = (client: BrowserAnalyticsClient) =>
  Effect.try({
    try: () => {
      client.opt_out_capturing();
      client.reset(true);
    },
    catch: browserAnalyticsLoadFailure,
  });

/** Captures the deferred landing view exactly once per loaded client. */
function captureInitialPageview(client: BrowserAnalyticsClient) {
  if (MutableRef.get(initialPageviewCaptured)) {
    return;
  }
  client.capture("$pageview");
  MutableRef.set(initialPageviewCaptured, true);
}

/**
 * Loads the always-on baseline client without changing capture consent.
 *
 * With `cookieless_mode: "on_reject"` plus opting out by default, undecided
 * and declined visitors are counted through PostHog's server-side hash while
 * nothing is stored in the browser. History tracking installs here; the
 * landing view waits for the first settled admission (see below).
 *
 * References:
 * https://posthog.com/tutorials/cookieless-tracking
 * https://posthog.com/docs/libraries/js/config
 */
export const enableBaselineAnalytics = Effect.fn(
  "Analytics.enableBaselineAnalytics"
)(function* <E = never>(load?: Effect.Effect<BrowserAnalyticsClient, E>) {
  return yield* Effect.gen(function* () {
    if (readAnalyticsClient()) {
      return;
    }

    revokeGate();
    const sdk: Effect.Effect<
      BrowserAnalyticsClient,
      E | BrowserAnalyticsLoadFailed
    > = load ?? loadBrowserAnalyticsSdk;
    const client: BrowserAnalyticsClient = yield* sdk.pipe(
      Effect.mapError(browserAnalyticsLoadFailure)
    );
    const runtimeKeys = yield* Effect.try({
      try: postHogPublicKeys,
      catch: browserAnalyticsLoadFailure,
    });

    yield* Effect.try({
      try: () => {
        client.init(runtimeKeys.VITE_POSTHOG_KEY, {
          advanced_disable_flags: true,
          api_host: runtimeKeys.VITE_POSTHOG_PROXY_HOST,
          autocapture: false,
          before_send: (event) =>
            filterAuthorizedAnalyticsEvent(
              event,
              MutableRef.get(identityAuthorization),
              MutableRef.get(analyticsTier)
            ),
          capture_dead_clicks: false,
          capture_exceptions: false,
          capture_heatmaps: false,
          capture_pageleave: false,
          capture_performance: false,
          capture_pageview: false,
          cookieless_mode: "on_reject",
          defaults: "2026-01-30",
          // A share link carries its token in the URL fragment, so no event
          // reports a fragment. Later `defaults` turn this on themselves.
          disable_capture_url_hashes: true,
          // Plain JSON bodies keep ingestion inspectable in tests and
          // debugging; pageview payloads are too small to need gzip.
          disable_compression: true,
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
          ui_host: runtimeKeys.VITE_POSTHOG_UI_HOST,
        });
      },
      catch: browserAnalyticsLoadFailure,
    });
    yield* Effect.sync(() => publishAnalyticsClient(client));
    // A navigation that lands before the first settled admission counts
    // instead, so the admission must not recount the same destination.
    yield* startPageviewTracking(client, () =>
      MutableRef.set(initialPageviewCaptured, true)
    ).pipe(Effect.provideService(PageviewWindow, window));
  }).pipe(Effect.tapError(() => Effect.sync(revokeGate)));
});

/** Aligns a granted client with the only browser identity it may capture. */
function synchronizeIdentity(
  client: BrowserAnalyticsClient,
  identity: BrowserAnalyticsIdentity
) {
  const trackedUserId = client.get_property("$user_id");
  if (identity.status === "anonymous") {
    if (trackedUserId) {
      client.reset(false);
    }

    client.register(createConsentEventProperties(identity, "anonymous"));
    MutableRef.set(identityAuthorization, { status: "anonymous" });
    return;
  }

  if (trackedUserId && trackedUserId !== identity.userId) {
    client.reset(false);
  }

  const roleProperties = identity.role ? { role: identity.role } : {};
  const personProperties = {
    plan: identity.plan,
    ...roleProperties,
  };
  client.register(createConsentEventProperties(identity, "account"));
  MutableRef.set(identityAuthorization, {
    status: "identified",
    userId: identity.userId,
  });
  if (trackedUserId === identity.userId) {
    client.setPersonProperties(personProperties);
    return;
  }
  client.identify(identity.userId, personProperties);
}

/**
 * Upgrades one baseline client to a consented identity in a single transition.
 *
 * Upgrade and identity sync move together so callers can never opt in without
 * authorizing identity. The landing view fires here on first admission only.
 */
export const admitConsentedIdentity = Effect.fn(
  "Analytics.admitConsentedIdentity"
)(function* (identity: BrowserAnalyticsIdentity) {
  const client = readAnalyticsClient();
  if (!client) {
    return yield* new BrowserAnalyticsLoadFailed({
      code: browserAnalyticsLoadFailedCode,
    });
  }

  const transitioned = MutableRef.get(analyticsTier) !== "granted";
  if (transitioned) {
    yield* Effect.try({
      try: () => client.opt_in_capturing({ captureEventName: false }),
      catch: browserAnalyticsLoadFailure,
    });
    MutableRef.set(analyticsTier, "granted");
  }

  yield* Effect.try({
    try: () => {
      synchronizeIdentity(client, identity);
      captureInitialPageview(client);
    },
    catch: browserAnalyticsLoadFailure,
  }).pipe(
    Effect.tapError(() =>
      Effect.sync(revokeGate).pipe(
        Effect.andThen(restoreBaselineSdk(client).pipe(Effect.ignore))
      )
    )
  );
});

/**
 * Returns one granted client to the always-on baseline tier in transition.
 *
 * The gate flips only after the SDK confirms the return, so a throwing
 * opt-out surfaces instead of stranding an opted-in SDK. Never-granted
 * callers only revoke the gate (persisted opt-ins reconciled the same way);
 * merely undecided visitors record nothing. The landing view fires here on
 * first admission only.
 */
export const revokeToBaselineAnalytics = Effect.fn(
  "Analytics.revokeToBaselineAnalytics"
)(function* () {
  const client = readAnalyticsClient();
  if (!client) {
    revokeGate();
    return;
  }

  const wasGranted = MutableRef.get(analyticsTier) === "granted";
  const hasPersistedOptIn = yield* Effect.try({
    try: () => client.get_explicit_consent_status() === "granted",
    catch: browserAnalyticsLoadFailure,
  });
  if (!(wasGranted || hasPersistedOptIn)) {
    revokeGate();
    yield* Effect.try({
      try: () => captureInitialPageview(client),
      catch: browserAnalyticsLoadFailure,
    });
    return;
  }

  yield* restoreBaselineSdk(client);
  revokeGate();
  yield* Effect.try({
    try: () => captureInitialPageview(client),
    catch: browserAnalyticsLoadFailure,
  });
});

/** Revokes identity authorization without touching SDK consent or identity. */
export function suspendBrowserAnalyticsIdentity() {
  MutableRef.set(identityAuthorization, { status: "unresolved" });
}

/** Adds the exact affirmative decision provenance to every granted event. */
function createConsentEventProperties(
  identity: BrowserAnalyticsIdentity,
  scope: AnalyticsConsentScope
) {
  return {
    $geoip_disable: false,
    consent_decided_at: DateTime.formatIso(
      DateTime.makeUnsafe(identity.consentDecidedAt)
    ),
    consent_decision: "granted",
    consent_mechanism: identity.consentMechanism,
    consent_notice_version: identity.consentNoticeVersion,
    consent_scope: scope,
  };
}

/** Clears a signed-out account identity without loading the analytics SDK. */
export function resetBrowserAnalyticsIdentity(resetDeviceId = false) {
  MutableRef.set(identityAuthorization, { status: "unresolved" });
  const client = readAnalyticsClient();
  if (client) {
    client.reset(resetDeviceId);
  }
}
