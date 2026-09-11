import { MutableRef } from "effect";
import type { CaptureResult } from "posthog-js";

type AnalyticsIdentityAuthorization =
  | { readonly status: "anonymous" }
  | { readonly status: "identified"; readonly userId: string }
  | { readonly status: "unresolved" };

/**
 * Capture tier honored by the browser analytics gate.
 *
 * `baseline` is the always-on cookieless tier: anonymous events only, no
 * browser storage, counted through PostHog's server-side hash. `granted` is
 * the explicit-consent tier with stable identity and full event detail.
 */
export type AnalyticsTier = "baseline" | "granted";

const identityAuthorization = MutableRef.make<AnalyticsIdentityAuthorization>({
  status: "unresolved",
});

const analyticsTier = MutableRef.make<AnalyticsTier>("baseline");

interface AnalyticsIdentityClient {
  reset: (resetDeviceId?: boolean) => void;
}

/** Starts one browser analytics lifecycle without stale authorization state. */
export function initializeAnalyticsIdentityAuthorization() {
  MutableRef.set(identityAuthorization, { status: "unresolved" });
  MutableRef.set(analyticsTier, "baseline");
}

/** Reads the capture tier currently honored by the analytics gate. */
export function getAnalyticsTier(): AnalyticsTier {
  return MutableRef.get(analyticsTier);
}

/** Elevates the gate to the explicit-consent tier after a grant decision. */
export function grantAnalyticsTier() {
  MutableRef.set(analyticsTier, "granted");
}

/** Returns the gate to the always-on baseline tier and revokes identity. */
export function revokeAnalyticsTier() {
  MutableRef.set(analyticsTier, "baseline");
  MutableRef.set(identityAuthorization, { status: "unresolved" });
}

/** Replaces the current analytics identity without changing capture consent. */
export function resetAnalyticsIdentity(
  client: AnalyticsIdentityClient,
  resetDeviceId = false
) {
  client.reset(resetDeviceId);
}

/** Authorizes identified analytics only after the current app user resolves. */
export function authorizeAnalyticsIdentity(userId: string) {
  MutableRef.set(identityAuthorization, { status: "identified", userId });
}

/** Authorizes anonymous analytics only after auth resolves without a user. */
export function authorizeAnonymousAnalyticsIdentity() {
  MutableRef.set(identityAuthorization, { status: "anonymous" });
}

/** Revokes identified analytics while auth identity is absent or unresolved. */
export function revokeAnalyticsIdentity() {
  MutableRef.set(identityAuthorization, { status: "unresolved" });
}

/**
 * Minimizes one baseline event URL to origin plus pathname.
 *
 * Query strings and fragments can carry user-entered text, so the always-on
 * tier never sends them. Granted-tier events keep full URLs under consent.
 */
function minimizeBaselineEventUrl(event: CaptureResult): CaptureResult {
  const currentUrl = event.properties.$current_url;
  const referrer = event.properties.$referrer;
  if (typeof currentUrl !== "string" && typeof referrer === "undefined") {
    return event;
  }

  let nextCurrentUrl: string | null = null;
  if (typeof currentUrl === "string" && URL.canParse(currentUrl)) {
    const parsed = new URL(currentUrl);
    nextCurrentUrl = `${parsed.origin}${parsed.pathname}`;
  }

  return {
    ...event,
    properties: {
      ...event.properties,
      $current_url: nextCurrentUrl,
      $referrer: null,
    },
  };
}

/**
 * Admits every anonymous event in any state, then admits only the exact
 * resolved identified identity.
 *
 * Anonymous admission is what keeps always-on cookieless counting alive for
 * undecided, declined, and privacy-signal visitors. Baseline events additionally
 * lose query strings, fragments, and referrer URLs (referring domains stay).
 */
export function filterAuthorizedAnalyticsEvent(event: CaptureResult | null) {
  if (!event) {
    return null;
  }

  const eventUserId = event.properties.$user_id;
  if (typeof eventUserId === "string") {
    const authorization = MutableRef.get(identityAuthorization);
    return authorization.status === "identified" &&
      authorization.userId === eventUserId
      ? event
      : null;
  }

  return MutableRef.get(analyticsTier) === "granted"
    ? event
    : minimizeBaselineEventUrl(event);
}
