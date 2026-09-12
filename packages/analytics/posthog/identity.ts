import { Predicate } from "effect";
import type { CaptureResult } from "posthog-js";

/**
 * Capture tier honored by the browser analytics gate.
 *
 * `baseline` is the always-on cookieless tier: anonymous events only, no
 * browser storage, counted through PostHog's server-side hash. `granted` is
 * the explicit-consent tier with stable identity and full event detail.
 */
export type AnalyticsTier = "baseline" | "granted";

export type AnalyticsIdentityAuthorization =
  | { readonly status: "anonymous" }
  | { readonly status: "identified"; readonly userId: string }
  | { readonly status: "unresolved" };

/**
 * Minimizes one baseline event URL to origin plus pathname.
 *
 * Query strings and fragments can carry user-entered text, so the always-on
 * tier never sends them. Granted-tier events keep full URLs under consent.
 */
function minimizeBaselineEventUrl(event: CaptureResult): CaptureResult {
  const currentUrl = event.properties.$current_url;
  const referrer = event.properties.$referrer;
  if (!Predicate.isString(currentUrl) && Predicate.isUndefined(referrer)) {
    return event;
  }

  let nextCurrentUrl: string | null = null;
  if (Predicate.isString(currentUrl) && URL.canParse(currentUrl)) {
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
 * Anonymous admission keeps always-on cookieless counting alive for undecided,
 * declined, and privacy-signal visitors. Baseline events additionally lose
 * query strings, fragments, and referrer URLs (referring domains stay).
 */
export function filterAuthorizedAnalyticsEvent(
  event: CaptureResult | null,
  authorization: AnalyticsIdentityAuthorization,
  tier: AnalyticsTier
): CaptureResult | null {
  if (!event) {
    return null;
  }

  const eventUserId = event.properties.$user_id;
  if (Predicate.isString(eventUserId)) {
    return authorization.status === "identified" &&
      authorization.userId === eventUserId
      ? event
      : null;
  }

  return tier === "granted" ? event : minimizeBaselineEventUrl(event);
}
