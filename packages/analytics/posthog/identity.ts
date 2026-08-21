import { MutableRef } from "effect";
import type { CaptureResult } from "posthog-js";

type AnalyticsIdentityAuthorization =
  | { readonly status: "anonymous" }
  | { readonly status: "identified"; readonly userId: string }
  | { readonly status: "unresolved" };

const identityAuthorization = MutableRef.make<AnalyticsIdentityAuthorization>({
  status: "unresolved",
});

interface AnalyticsIdentityClient {
  has_opted_out_capturing(): boolean;
  opt_in_capturing(options: { readonly captureEventName: false }): void;
  opt_out_capturing(): void;
  reset(resetDeviceId?: boolean): void;
}

/** Starts one browser analytics lifecycle without stale authorization state. */
export function initializeAnalyticsIdentityAuthorization() {
  MutableRef.set(identityAuthorization, { status: "unresolved" });
}

/** Replaces the current analytics identity without changing capture consent. */
export function resetAnalyticsIdentity(
  client: AnalyticsIdentityClient,
  resetDeviceId = false
) {
  const wasOptedOut = client.has_opted_out_capturing();
  client.reset(resetDeviceId);

  if (wasOptedOut) {
    client.opt_out_capturing();
    return;
  }

  client.opt_in_capturing({ captureEventName: false });
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
 * Rejects every event until auth resolves, then admits only the exact resolved
 * anonymous or identified identity.
 */
export function filterAuthorizedAnalyticsEvent(event: CaptureResult | null) {
  if (!event) {
    return null;
  }

  const authorization = MutableRef.get(identityAuthorization);
  const eventUserId = event.properties.$user_id;

  if (authorization.status === "unresolved") {
    return null;
  }

  if (authorization.status === "anonymous") {
    return typeof eventUserId === "string" ? null : event;
  }

  return authorization.userId === eventUserId ? event : null;
}
