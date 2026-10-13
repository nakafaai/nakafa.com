import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { answered, cutOff } from "@repo/backend/confect/nina/journal";
import { closeTurn } from "@repo/backend/confect/nina/settlement";
import { Effect } from "effect";

/**
 * Ends an open turn that `settleTurn` could not settle, so that no failure of
 * the Agent journal keeps the chat busy and the credits held for good. The sweep
 * ends a turn this way when every try to settle it failed, and the delete of a
 * chat ends its open turn this way when the first try fails, so the learner can
 * always delete a chat (`chatsHandler`). The journal is used while it works: an
 * answer it holds still completes the turn. A journal that cannot be read
 * counts as holding no answer, and one that cannot cut the turn off is left as
 * it is; the log keeps the turn in both cases. A turn the learner stopped ends
 * as cancelled, any other as failed for a reason the learner reads as
 * "unknown". Only an active turn is passed in, so a second ending of the same
 * turn changes nothing and the hold is paid back once.
 *
 * The reason is `unknown` and not one of its own because a new reason is a new
 * value that every web build must read and word before the backend may store
 * it (ADR 0001). The refund is the one step it never skips: a hold that cannot
 * be paid back, because the credit state cannot be read or written, fails the
 * whole ending and changes nothing, the cut-off included. The learner's credits
 * are not dropped to free the chat, and the next sweep tries again. That is the
 * storage every credit operation of the learner reads, so no fallback could
 * route around it.
 */
export const abandonTurn = Effect.fn("nina.abandon.turn")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>
) {
  yield* Effect.logError("Nina ended a turn whose settlement failed", {
    turnId: turn._id,
  });
  const interrupted =
    turn.cancelRequestedAt === undefined ? "failed" : "cancelled";
  const completed = yield* answered(turn).pipe(
    Effect.catchTag("NinaTurnError", () =>
      Effect.as(
        Effect.logWarning("Nina could not read the journal of an ended turn", {
          turnId: turn._id,
        }),
        false
      )
    )
  );
  if (!completed) {
    yield* cutOff(turn, interrupted).pipe(
      Effect.catchTag("NinaTurnError", () =>
        Effect.logWarning(
          "Nina could not cut off the journal of an ended turn",
          { turnId: turn._id }
        )
      )
    );
  }
  yield* closeTurn(turn, completed ? "complete" : interrupted, "unknown");
});
