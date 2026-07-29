import { MutableRef } from "effect";
import type { CaptureResult } from "posthog-js";

type AnalyticsIdentityAuthorization =
  | { readonly status: "anonymous" }
  | { readonly status: "identified"; readonly userId: string }
  | { readonly status: "unresolved" };

const identityAuthorization = MutableRef.make<AnalyticsIdentityAuthorization>({
  status: "unresolved",
});
const posthogPageviewEvent = "$pageview";
const deferredPageview = MutableRef.make(false);

interface AnalyticsIdentityClient {
  get_property(key: string): unknown;
  has_opted_out_capturing(): boolean;
  opt_out_capturing(): void;
  reset(resetDeviceId?: boolean): void;
}

interface AnalyticsPageviewClient {
  capture(event: typeof posthogPageviewEvent): unknown;
}

/** Starts one browser analytics lifecycle without stale authorization state. */
export function initializeAnalyticsIdentityAuthorization() {
  MutableRef.set(identityAuthorization, { status: "unresolved" });
  MutableRef.set(deferredPageview, false);
}

/** Resolves analytics identity only from definitive auth and app-user state. */
export function resolveAnalyticsIdentityAuthorization({
  isAuthenticated,
  isAuthLoading,
  isUserResolved,
  userId,
}: {
  readonly isAuthenticated: boolean;
  readonly isAuthLoading: boolean;
  readonly isUserResolved: boolean;
  readonly userId: string | null;
}): AnalyticsIdentityAuthorization {
  if (isAuthLoading) {
    return { status: "unresolved" };
  }

  if (!isAuthenticated) {
    return { status: "anonymous" };
  }

  if (!(isUserResolved && userId)) {
    return { status: "unresolved" };
  }

  return { status: "identified", userId };
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
  }
}

/** Removes a persisted identified user before the SDK's initial pageview. */
export function resetPersistedAnalyticsIdentity(
  client: AnalyticsIdentityClient
) {
  if (typeof client.get_property("$user_id") !== "string") {
    return;
  }

  resetAnalyticsIdentity(client);
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

/** Emits one initial pageview that waited for definitive auth resolution. */
export function captureDeferredAnalyticsPageview(
  client: AnalyticsPageviewClient
) {
  if (
    !MutableRef.get(deferredPageview) ||
    MutableRef.get(identityAuthorization).status === "unresolved"
  ) {
    return false;
  }

  MutableRef.set(deferredPageview, false);
  client.capture(posthogPageviewEvent);
  return true;
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
    if (event.event === posthogPageviewEvent) {
      MutableRef.set(deferredPageview, true);
    }

    return null;
  }

  if (event.event === posthogPageviewEvent) {
    MutableRef.set(deferredPageview, false);
  }

  if (authorization.status === "anonymous") {
    return typeof eventUserId === "string" ? null : event;
  }

  return authorization.userId === eventUserId ? event : null;
}
