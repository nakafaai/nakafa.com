import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { NinaCreditError } from "@repo/backend/confect/nina/credits/schema";
import { TURN_DEADLINE } from "@repo/backend/confect/nina/deadline";
import { Array as Arr, Clock, Duration, Effect } from "effect";

/** The most turns one learner may have queued or running at once. */
const OPEN_TURN_LIMIT = 2;

/**
 * The learner's newest queued or running turns, as many as the limit allows
 * open at once. Every open turn is among them, because a turn past its deadline
 * is older than any turn still open.
 */
export const activeTurns = Effect.fn("nina.capacity.active")(function* (
  userId: Docs["users"]["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("ninaTurns")
    .index(
      "by_userId_and_phase",
      (q) => q.eq("userId", userId).eq("phase", "active"),
      "desc"
    )
    .take(OPEN_TURN_LIMIT)
    .pipe(Effect.orDie);
});

/**
 * Refuses a learner who already has the most open turns, with the rejection
 * admission already uses for its limits. Admission runs it before it holds any
 * credit, so a refusal leaves nothing to refund. A turn counts from admission
 * until its deadline: past it the turn can no longer run and waits only for the
 * sweep, so a settlement that keeps failing never locks the learner out.
 */
export const requireOpenCapacity = Effect.fn("nina.capacity.require")(
  function* (userId: Docs["users"]["_id"]) {
    const since =
      (yield* Clock.currentTimeMillis) - Duration.toMillis(TURN_DEADLINE);
    const open = Arr.filter(
      yield* activeTurns(userId),
      (turn) => turn._creationTime >= since
    );
    if (open.length >= OPEN_TURN_LIMIT) {
      return yield* new NinaCreditError({
        code: "RATE_LIMITED",
        message: "Too many Nina responses are running at once.",
      });
    }
  }
);
