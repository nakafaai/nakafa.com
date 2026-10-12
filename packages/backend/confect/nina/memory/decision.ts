import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { judge } from "@repo/backend/confect/nina/judgment/ask";
import { judgmentFailure } from "@repo/backend/confect/nina/memory/failure";
import type { NinaMemoryCandidate } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, Effect, String as Str } from "effect";

/**
 * Whether the capture call is worth making for a message: it has a character
 * besides whitespace, memory is on, and a decision model finds something in the
 * message that will still matter in later study sessions (`judgment/catalog`).
 * A paused learner's message goes to no model, and a decision that cannot be
 * made fails with the typed error, so that the capture saves nothing for the
 * turn.
 */
export const isLasting = Effect.fn("nina.memory.lasting")(function* (
  userId: NinaTurnsDoc["userId"],
  message: string
) {
  if (Str.isEmpty(Str.trim(message))) {
    return false;
  }
  const paused = yield* (yield* QueryRunner)
    .runQuery(refs.internal.nina.memory.paused, { userId })
    .pipe(Effect.orDie);
  if (paused) {
    return false;
  }
  const [verdict] = yield* judge(["lasting"], [message]).pipe(
    Effect.mapError(judgmentFailure)
  );
  return verdict.lasting;
});

/**
 * Keeps the candidates in which the decision model finds nothing private. It
 * judges the sentence of each candidate together with its quote, all of them in
 * one request. A decision that cannot be made fails with the typed error, so
 * that none of the candidates is kept.
 */
export const withoutPrivate = Effect.fn("nina.memory.withoutPrivate")(
  function* <
    Candidate extends Pick<typeof NinaMemoryCandidate.Type, "quote" | "text">,
  >(candidates: readonly Candidate[]) {
    const verdicts = yield* judge(
      ["private"],
      Arr.map(candidates, ({ quote, text }) => `${text}\n${quote}`)
    ).pipe(Effect.mapError(judgmentFailure));
    return Arr.map(
      Arr.filter(
        Arr.zip(candidates, verdicts),
        ([, verdict]) => !verdict.private
      ),
      ([candidate]) => candidate
    );
  }
);
