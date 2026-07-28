import { MutableRef, Option } from "effect";
import type { CaptureResult } from "posthog-js";

const authorizedUserId = MutableRef.make(Option.none<string>());

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
