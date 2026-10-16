import type { MessageDoc } from "@convex-dev/agent";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { NinaMemoryError } from "@repo/backend/confect/nina/memory/failure";
import { readMessageFromAction } from "@repo/backend/confect/nina/sealed/action";
import { Effect, Option } from "effect";

/**
 * The learner's own words in the message that opened a turn: its text. A prompt
 * that is not the learner's words, such as an answer of Nina's, says nothing
 * about them, so it reads as no words, and so does a message that is gone.
 */
export function saidOf(prompt: MessageDoc | null | undefined) {
  return Option.fromNullishOr(prompt).pipe(
    Option.filter(({ message }) => message?.role === "user"),
    Option.flatMapNullishOr(({ text }) => text),
    Option.getOrElse(() => "")
  );
}

/**
 * Reads the learner's own words of a turn (`saidOf`) from an action, opened for
 * the learner who owns the turn. A message the Agent component cannot read fails
 * with the typed error of a background memory call.
 */
export const readSaid = Effect.fn("nina.memory.said")(function* (
  turn: Pick<NinaTurnsDoc, "promptMessageId" | "userId">
) {
  const prompt = yield* readMessageFromAction(
    turn.userId,
    turn.promptMessageId
  ).pipe(
    Effect.mapError(
      () => new NinaMemoryError({ operation: "read", rejected: false })
    )
  );
  return saidOf(prompt);
});
