import { tryoutAttemptAccessSourceKindSubscription } from "@repo/backend/confect/tryouts/access/source";
import { loadActiveProSubscription } from "@repo/backend/confect/tryouts/access/subscription";
import type {
  AttemptAccessFields,
  TryoutStartScope,
} from "@repo/backend/confect/tryouts/start/spec";
import { Effect } from "effect";

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
