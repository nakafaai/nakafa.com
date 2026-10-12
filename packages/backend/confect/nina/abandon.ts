import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { answered, cutOff } from "@repo/backend/confect/nina/journal";
import { closeTurn } from "@repo/backend/confect/nina/settlement";
import { Effect } from "effect";

/**
 * Ends an open turn that `settleTurn` could not settle in all the tries the
 * sweep gave it, so that no failure of the Agent journal keeps the chat busy,
 * the credits held and the chat undeletable for good. The journal is used
 * while it works: an answer it holds still completes the turn. A journal that
 * cannot be read counts as holding no answer, and one that cannot cut the turn
 * off is left as it is; the log keeps the turn in both cases. A turn the
 * learner stopped ends as cancelled, any other as failed for a reason the
 * learner reads as "unknown". Only an active turn is passed in, so a second
 * ending of the same turn changes nothing and the hold is paid back once.
 */
export const abandonTurn = Effect.fn("nina.abandon.turn")(function* (
  turn: Extract<NinaTurnsDoc, { phase: "active" }>
) {
  yield* Effect.logError("Nina ended a turn whose settlement kept failing", {
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
