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
  authorizeAnalyticsIdentity,
  authorizeAnonymousAnalyticsIdentity,
  filterAuthorizedAnalyticsEvent,
  initializeAnalyticsIdentityAuthorization,
  resetAnalyticsIdentity,
  revokeAnalyticsIdentity,
} from "@repo/analytics/posthog/identity";
import { Effect, MutableRef, Option, Schema } from "effect";
import type { Properties } from "posthog-js";

interface BrowserAnalyticsClient {
  captureException(error: unknown, properties?: Properties): unknown;
  get_property(key: string): unknown;
  has_opted_out_capturing(): boolean;
  identify(userId: string, properties: Properties): void;
  init(
    token: string,
    config: {
      readonly advanced_disable_flags: true;
      readonly api_host: string;
      readonly autocapture: false;
      readonly before_send: typeof filterAuthorizedAnalyticsEvent;
      readonly capture_dead_clicks: false;
      readonly capture_exceptions: false;
      readonly capture_heatmaps: false;
      readonly capture_pageleave: false;
      readonly capture_performance: false;
      readonly capture_pageview: false;
      readonly defaults: "2026-01-30";
      readonly disable_conversations: true;
      readonly disableDeviceModel: true;
      readonly disable_external_dependency_loading: true;
      readonly disable_product_tours: true;
      readonly disable_session_recording: true;
      readonly disable_surveys: true;
      readonly disable_web_experiments: true;
      readonly enable_recording_console_log: false;
      readonly mask_all_element_attributes: true;
      readonly mask_all_text: true;
      readonly opt_out_capturing_by_default: true;
      readonly opt_out_persistence_by_default: true;
      readonly persistence: "localStorage";
      readonly person_profiles: "identified_only";
      readonly property_denylist: string[];
      readonly rageclick: false;
      readonly request_batching: false;
      readonly respect_dnt: true;
      readonly save_campaign_params: false;
      readonly save_referrer: false;
      readonly ui_host: string;
    }
  ): unknown;
  opt_in_capturing(options: { readonly captureEventName: false }): void;
  opt_out_capturing(): void;
  register(properties: Properties): void;
  reset(resetDeviceId?: boolean): void;
  setPersonProperties(properties: Properties): void;
}

interface BrowserAnalyticsLoader {
  readonly load: () => Promise<BrowserAnalyticsClient>;
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
const analyticsEnabled = MutableRef.make(false);
const privateAutomaticEventProperties = [
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
];

const defaultBrowserAnalyticsLoader: BrowserAnalyticsLoader = {
  load: () => import("posthog-js").then((module) => module.default),
};

/** Raised when a consented browser cannot initialize the analytics SDK. */
export class BrowserAnalyticsLoadFailed extends Schema.TaggedError<BrowserAnalyticsLoadFailed>()(
  "BrowserAnalyticsLoadFailed",
  { code: Schema.Literal(browserAnalyticsLoadFailedCode) }
) {}

const browserAnalyticsLoadFailure = () =>
  new BrowserAnalyticsLoadFailed({ code: browserAnalyticsLoadFailedCode });

/** Loads and enables PostHog only after the caller has resolved consent. */
export const enableBrowserAnalytics = Effect.fn(
  "Analytics.enableBrowserAnalytics"
)(function* (loader: BrowserAnalyticsLoader = defaultBrowserAnalyticsLoader) {
  MutableRef.set(analyticsEnabled, true);
  return yield* Effect.gen(function* () {
    const existingClient = MutableRef.get(analyticsClient);
    if (existingClient) {
      yield* Effect.try({
        try: () => existingClient.opt_in_capturing({ captureEventName: false }),
        catch: browserAnalyticsLoadFailure,
      });
      return;
    }

    initializeAnalyticsIdentityAuthorization();
    const client = yield* Effect.tryPromise({
      try: loader.load,
      catch: browserAnalyticsLoadFailure,
    });
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
          before_send: filterAuthorizedAnalyticsEvent,
          capture_dead_clicks: false,
          capture_exceptions: false,
          capture_heatmaps: false,
          capture_pageleave: false,
          capture_performance: false,
          capture_pageview: false,
          defaults: "2026-01-30",
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
          property_denylist: privateAutomaticEventProperties,
          rageclick: false,
          request_batching: false,
          respect_dnt: true,
          save_campaign_params: false,
          save_referrer: false,
          ui_host: runtimeKeys.NEXT_PUBLIC_POSTHOG_UI_HOST,
        });
        client.reset(true);
      },
      catch: browserAnalyticsLoadFailure,
    });
    MutableRef.set(analyticsClient, client);

    if (!MutableRef.get(analyticsEnabled)) {
      yield* Effect.try({
        try: () => client.opt_out_capturing(),
        catch: browserAnalyticsLoadFailure,
      });
      return;
    }

    yield* Effect.try({
      try: () => client.opt_in_capturing({ captureEventName: false }),
      catch: browserAnalyticsLoadFailure,
    });
  }).pipe(Effect.tapError(() => disableBrowserAnalytics()));
});

/** Stops future capture and clears all PostHog browser identity state. */
export const disableBrowserAnalytics = Effect.fn(
  "Analytics.disableBrowserAnalytics"
)(function* () {
  MutableRef.set(analyticsEnabled, false);
  revokeAnalyticsIdentity();

  const client = MutableRef.get(analyticsClient);
  if (!client) {
    return;
  }

  yield* Effect.try({
    try: () => {
      client.reset(true);
      client.opt_out_capturing();
    },
    catch: browserAnalyticsLoadFailure,
  }).pipe(Effect.ignore);
});

/** Aligns an enabled client with the only browser identity it may capture. */
export const synchronizeBrowserAnalyticsIdentity = Effect.fn(
  "Analytics.synchronizeBrowserAnalyticsIdentity"
)(function* (identity: BrowserAnalyticsIdentity) {
  const client = MutableRef.get(analyticsClient);
  if (!(client && MutableRef.get(analyticsEnabled))) {
    return;
  }

  yield* Effect.try({
    try: () => {
      const trackedUserId = client.get_property("$user_id");
      if (identity.status === "anonymous") {
        if (trackedUserId) {
          resetAnalyticsIdentity(client);
        }

        client.register(createConsentEventProperties(identity, "anonymous"));
        authorizeAnonymousAnalyticsIdentity();
        return;
      }

      if (trackedUserId && trackedUserId !== identity.userId) {
        resetAnalyticsIdentity(client);
      }

      const roleProperties = identity.role ? { role: identity.role } : {};
      const personProperties = {
        plan: identity.plan,
        ...roleProperties,
      };
      client.register(createConsentEventProperties(identity, "account"));
      authorizeAnalyticsIdentity(identity.userId);
      if (trackedUserId === identity.userId) {
        client.setPersonProperties(personProperties);
        return;
      }
      client.identify(identity.userId, personProperties);
    },
    catch: browserAnalyticsLoadFailure,
  }).pipe(Effect.tapError(() => disableBrowserAnalytics()));
});

/** Adds the exact affirmative decision provenance to every admitted event. */
function createConsentEventProperties(
  identity: BrowserAnalyticsIdentity,
  scope: "account" | "anonymous"
) {
  return {
    $geoip_disable: true,
    consent_decided_at: new Date(identity.consentDecidedAt).toISOString(),
    consent_decision: "granted",
    consent_mechanism: identity.consentMechanism,
    consent_notice_version: identity.consentNoticeVersion,
    consent_scope: scope,
  };
}

/** Clears a signed-out account identity without loading the analytics SDK. */
export function resetBrowserAnalyticsIdentity(resetDeviceId = false) {
  revokeAnalyticsIdentity();
  const client = MutableRef.get(analyticsClient);
  if (client) {
    resetAnalyticsIdentity(client, resetDeviceId);
  }
}

/** Captures one handled client exception without ever loading the SDK. */
export function captureException(
  error: unknown,
  properties: OperationalExceptionProperties
) {
  if (!MutableRef.get(analyticsEnabled)) {
    return;
  }
  const decodedProperties = decodeOperationalExceptionProperties(properties);
  if (Option.isNone(decodedProperties)) {
    return;
  }
  MutableRef.get(analyticsClient)?.captureException(
    createOperationalException(error),
    decodedProperties.value
  );
}
