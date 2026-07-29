import { MutableRef, Option } from "effect";
import type { CaptureResult } from "posthog-js";

const authorizedUserId = MutableRef.make(Option.none<string>());

interface AnalyticsIdentityClient {
  get_property(key: string): unknown;
  has_opted_out_capturing(): boolean;
  opt_out_capturing(): void;
  reset(resetDeviceId?: boolean): void;
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
  MutableRef.set(authorizedUserId, Option.some(userId));
}

/** Revokes identified analytics while auth identity is absent or unresolved. */
export function revokeAnalyticsIdentity() {
  MutableRef.set(authorizedUserId, Option.none());
}

/**
 * Allows anonymous analytics immediately but rejects identified events until
 * the current browser runtime has authorized that exact app user.
 */
export function filterAuthorizedAnalyticsEvent(event: CaptureResult | null) {
  if (!event) {
    return null;
  }

  const eventUserId = event.properties.$user_id;

  if (typeof eventUserId !== "string") {
    return event;
  }

  return Option.match(MutableRef.get(authorizedUserId), {
    onNone: () => null,
    onSome: (userId) => (userId === eventUserId ? event : null),
  });
}
