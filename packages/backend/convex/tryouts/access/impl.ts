import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { tryoutAttemptAccessSourceKindSubscription } from "@repo/backend/convex/tryouts/access/source";
import { loadActiveProSubscription } from "@repo/backend/convex/tryouts/access/subscription";
import type {
  AttemptAccessFields,
  TryoutStartAccess,
  TryoutStartScope,
} from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

type TryoutAccessReadCtx = Pick<QueryCtx, "db">;

/** Resolves the advisory start state from the authoritative subscription. */
export const getTryoutStartAccess = Effect.fn(
  "tryouts.access.getTryoutStartAccess"
)(function* (ctx: TryoutAccessReadCtx, args: TryoutStartScope) {
  const subscription = yield* loadActiveProSubscription(ctx, args);
  return {
    kind: subscription ? "included" : "free-attempt",
  } satisfies TryoutStartAccess;
});

/** Records subscription attribution without creating a second access store. */
export const getIncludedAttemptAccess = Effect.fn(
  "tryouts.access.getIncludedAttemptAccess"
)(function* (ctx: TryoutAccessReadCtx, args: TryoutStartScope) {
  const access = yield* loadActiveProSubscription(ctx, args);
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
