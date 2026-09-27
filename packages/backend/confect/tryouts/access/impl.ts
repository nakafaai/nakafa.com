import { tryoutAttemptAccessSourceKindSubscription } from "@repo/backend/confect/tryouts/access/source";
import { loadActiveProSubscription } from "@repo/backend/confect/tryouts/access/subscription";
import type {
  AttemptAccessFields,
  TryoutStartAccess,
  TryoutStartScope,
} from "@repo/backend/confect/tryouts/start/spec";
import { Effect } from "effect";

/** Resolves the advisory start state from the authoritative subscription. */
export const getTryoutStartAccess = Effect.fn(
  "tryouts.access.getTryoutStartAccess"
)(function* (args: TryoutStartScope) {
  const subscription = yield* loadActiveProSubscription(args);
  return {
    kind: subscription ? "included" : "free-attempt",
  } satisfies TryoutStartAccess;
});

/** Records subscription attribution without creating a second access store. */
export const getIncludedAttemptAccess = Effect.fn(
  "tryouts.access.getIncludedAttemptAccess"
)(function* (args: TryoutStartScope) {
  const access = yield* loadActiveProSubscription(args);
  if (!access) {
    return null;
  }
  return {
    accessEndsAt: access.endsAt,
    accessSourceKind: tryoutAttemptAccessSourceKindSubscription,
    accessSubscriptionId: access.subscription.id,
    countsForCompetition: false,
  } satisfies AttemptAccessFields;
});
