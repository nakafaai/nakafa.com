import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { NinaMemoryError } from "@repo/backend/confect/nina/memory/failure";
import { Effect, Option } from "effect";

/**
 * Reads the learner's own words of a turn: the text of the message that opened
 * it. A prompt that is not the learner's words, such as an answer of Nina's,
 * says nothing about them, so it reads as no words. A message the Agent
 * component cannot read fails with the typed error of a background memory call.
 */
export const readSaid = Effect.fn("nina.memory.said")(function* (
  turn: Pick<NinaTurnsDoc, "promptMessageId">
) {
  const ctx = yield* ActionCtx;
  const [prompt] = yield* Effect.tryPromise({
    try: () =>
      ctx.runQuery(components.nina.messages.getMessagesByIds, {
        messageIds: [turn.promptMessageId],
      }),
    catch: () => new NinaMemoryError({ operation: "read", rejected: false }),
  });
  return Option.fromNullishOr(prompt).pipe(
    Option.filter(({ message }) => message?.role === "user"),
    Option.flatMapNullishOr(({ text }) => text),
    Option.getOrElse(() => "")
  );
});
