import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { NinaCreditError } from "@repo/backend/confect/nina/credits/schema";
import { Effect } from "effect";

/** The most turns one learner may have queued or running at once. */
export const OPEN_TURN_LIMIT = 2;

/**
 * Refuses a learner who already has the most open turns, with the rejection
 * admission already uses for its limits. Admission runs it before it holds any
 * credit, so a refusal leaves nothing to refund.
 */
export const requireOpenCapacity = Effect.fn("nina.capacity.require")(
  function* (userId: Docs["users"]["_id"]) {
    const open = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .index("by_userId_and_phase", (q) =>
        q.eq("userId", userId).eq("phase", "active")
      )
      .take(OPEN_TURN_LIMIT)
      .pipe(Effect.orDie);
    if (open.length >= OPEN_TURN_LIMIT) {
      return yield* new NinaCreditError({
        code: "RATE_LIMITED",
        message: "Too many Nina responses are running at once.",
      });
    }
  }
);
