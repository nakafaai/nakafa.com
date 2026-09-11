"use client";

import type { AnonymousAnalyticsConsentRecord } from "@repo/analytics/consent";
import { keys } from "@repo/analytics/keys";
import { POSTHOG_PROXY_PATH } from "@repo/analytics/posthog/config";
import {
  createOperationalException,
  decodeOperationalExceptionProperties,
  type OperationalExceptionProperties,
} from "@repo/analytics/posthog/exception";
import {
  type AnalyticsIdentityAuthorization,
  type AnalyticsTier,
  filterAuthorizedAnalyticsEvent,
} from "@repo/analytics/posthog/identity";
import { startPageviewTracking } from "@repo/analytics/posthog/pageview";
import { Effect, MutableRef, Option, Schema } from "effect";
import type { PostHog } from "posthog-js";

export type BrowserAnalyticsClient = Pick<
  PostHog,
  | "capture"
  | "captureException"
  | "get_explicit_consent_status"
  | "get_property"
  | "identify"
  | "init"
  | "opt_in_capturing"
  | "opt_out_capturing"
  | "register"
  | "reset"
  | "setPersonProperties"
>;

interface BrowserAnalyticsLoader {
  readonly load: Effect.Effect<BrowserAnalyticsClient, unknown>;
}

export type BrowserAnalyticsIdentity =
  | {
      readonly consentDecidedAt: AnonymousAnalyticsConsentRecord["decidedAt"];
      readonly consentMechanism: AnonymousAnalyticsConsentRecord["mechanism"];
      readonly consentNoticeVersion: AnonymousAnalyticsConsentRecord["noticeVersion"];
      readonly status: "anonymous";
    }
  | {
      readonly consentDecidedAt: AnonymousAnalyticsConsentRecord["decidedAt"];
      readonly consentMechanism: AnonymousAnalyticsConsentRecord["mechanism"];
      readonly consentNoticeVersion: AnonymousAnalyticsConsentRecord["noticeVersion"];
      readonly plan: string;
      readonly role: string | null;
      readonly status: "identified";
      readonly userId: string;
    };

const browserAnalyticsLoadFailedCode = "BROWSER_ANALYTICS_LOAD_FAILED";
const analyticsClient = MutableRef.make<BrowserAnalyticsClient | undefined>(
  undefined
);
const analyticsTier = MutableRef.make<AnalyticsTier>("baseline");
const identityAuthorization = MutableRef.make<AnalyticsIdentityAuthorization>({
  status: "unresolved",
});

/** Raised when the baseline client cannot initialize or upgrade. */
export class BrowserAnalyticsLoadFailed extends Schema.TaggedError<BrowserAnalyticsLoadFailed>()(
  "BrowserAnalyticsLoadFailed",
  { code: Schema.Literal(browserAnalyticsLoadFailedCode) }
) {}

const browserAnalyticsLoadFailure = () =>
  new BrowserAnalyticsLoadFailed({ code: browserAnalyticsLoadFailedCode });

const defaultBrowserAnalyticsLoader: BrowserAnalyticsLoader = {
  load: Effect.tryPromise(() => import("posthog-js")).pipe(
    Effect.map((module) => module.default)
  ),
};

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

/**
 * Loads the always-on baseline client without changing capture consent.
 *
 * With `cookieless_mode: "on_reject"` plus opting out by default, undecided
 * and declined visitors are counted through PostHog's server-side hash while
 * nothing is stored in the browser. Pageviews are captured explicitly (initial
 * plus history navigations) so each view lands exactly once, after identity
 * is known — never duplicated across consent transitions.
 *
 * References:
 * https://posthog.com/tutorials/cookieless-tracking
 * https://posthog.com/docs/libraries/js/config
 */
export const enableBaselineAnalytics = Effect.fn(
  "Analytics.enableBaselineAnalytics"
)(function* (loader: BrowserAnalyticsLoader = defaultBrowserAnalyticsLoader) {
  return yield* Effect.gen(function* () {
    if (MutableRef.get(analyticsClient)) {
      return;
    }

    revokeGate();
    const client: BrowserAnalyticsClient = yield* loader.load.pipe(
      Effect.mapError(browserAnalyticsLoadFailure)
    );
    const runtimeKeys = yield* Effect.try({
      try: keys,
      catch: browserAnalyticsLoadFailure,
    });

    yield* Effect.try({
      try: () => {
        client.init(runtimeKeys.NEXT_PUBLIC_POSTHOG_KEY, {
          advanced_disable_flags: true,
          api_host: POSTHOG_PROXY_PATH,
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
          ui_host: runtimeKeys.NEXT_PUBLIC_POSTHOG_UI_HOST,
        });
      },
      catch: browserAnalyticsLoadFailure,
    });
    MutableRef.set(analyticsClient, client);
    startPageviewTracking(window, client);
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
 * authorizing identity. No pageview fires here: the load or navigation that
 * is already counted keeps the count exact, and the next navigation captures
 * under the consented identity.
 */
export const admitConsentedIdentity = Effect.fn(
  "Analytics.admitConsentedIdentity"
)(function* (identity: BrowserAnalyticsIdentity) {
  const client = MutableRef.get(analyticsClient);
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
 * The gate flips only after the SDK confirms the return: a throwing opt-out
 * surfaces the typed failure so the provider reports it and retries, instead
 * of leaving an opted-in SDK behind a baseline gate. Callers that never
 * granted only revoke the gate, unless the SDK itself reports a persisted
 * opt-in (a stale grant from an earlier session), which is reconciled the
 * same way. Recording an explicit opt-out for merely undecided visitors would
 * corrupt their pending consent state, so that path stays untouched. No
 * pageview fires here: the counted view keeps the count exact.
 */
export const revokeToBaselineAnalytics = Effect.fn(
  "Analytics.revokeToBaselineAnalytics"
)(function* () {
  const client = MutableRef.get(analyticsClient);
  const wasGranted = MutableRef.get(analyticsTier) === "granted";
  const hasPersistedOptIn = client?.get_explicit_consent_status() === "granted";
  if (!(client && (wasGranted || hasPersistedOptIn))) {
    revokeGate();
    return;
  }

  yield* restoreBaselineSdk(client);
  revokeGate();
});

/** Revokes identity authorization without touching SDK consent or identity. */
export function suspendBrowserAnalyticsIdentity() {
  MutableRef.set(identityAuthorization, { status: "unresolved" });
}

/** Adds the exact affirmative decision provenance to every granted event. */
function createConsentEventProperties(
  identity: BrowserAnalyticsIdentity,
  scope: "account" | "anonymous"
) {
  return {
    $geoip_disable: false,
    consent_decided_at: new Date(identity.consentDecidedAt).toISOString(),
    consent_decision: "granted",
    consent_mechanism: identity.consentMechanism,
    consent_notice_version: identity.consentNoticeVersion,
    consent_scope: scope,
  };
}

/** Clears a signed-out account identity without loading the analytics SDK. */
export function resetBrowserAnalyticsIdentity(resetDeviceId = false) {
  MutableRef.set(identityAuthorization, { status: "unresolved" });
  const client = MutableRef.get(analyticsClient);
  if (client) {
    client.reset(resetDeviceId);
  }
}

/**
 * Captures one handled client exception through the always-on baseline.
 *
 * The minimized operational payload carries no identity or user content, so
 * scrubbed reliability reporting stays available in every consent state. The
 * baseline before_send gate additionally minimizes event URLs.
 */
export function captureException(
  error: unknown,
  properties: OperationalExceptionProperties
) {
  const decodedProperties = decodeOperationalExceptionProperties(properties);
  if (Option.isNone(decodedProperties)) {
    return;
  }
  MutableRef.get(analyticsClient)?.captureException(
    createOperationalException(error),
    decodedProperties.value
  );
}
