import { Gateway } from "@repo/backend/confect/gateway/handle";
import { boundText } from "@repo/backend/confect/nina/budget";
import {
  type JudgmentName,
  judgments,
} from "@repo/backend/confect/nina/judgment/catalog";
import { Effect, Record as Rec, Struct } from "effect";

/** Tokens of one text that the decision model reads. */
const TEXT_TOKENS = 1000;

/**
 * The probability that each named judgment is true of one text, a record by
 * the name of the judgment. The text goes to the decision model as it is, cut to
 * what the model reads, and every question about it goes in one request. A
 * request holds one text and no more, because the model separates the notes of
 * `ownNote` better when it reads one note alone (ADR 0022).
 *
 * Only the command that measures the judgments against a labelled set reads
 * these numbers (`judgment/measure`). Everything else asks `judge`, so that no
 * caller sees a probability.
 */
export const probabilities = Effect.fn("nina.judgment.probabilities")(
  function* <const Names extends readonly [JudgmentName, ...JudgmentName[]]>(
    names: Names,
    text: string
  ) {
    const answers = yield* (yield* Gateway).decide(
      boundText(text, TEXT_TOKENS, "The text is shortened."),
      Rec.map(Struct.pick(judgments, names), ({ instructions, type }) => ({
        instructions,
        type,
      }))
    );
    return Rec.map(answers, ({ probability }) => probability);
  }
);

/**
 * Asks the named judgments about one text, with one decision request for all of
 * them, and answers with a record of the named judgments, each true or false. A
 * judgment is true from the probability its entry names (`judgment/catalog`).
 * The caller never sees a probability, a threshold or a model.
 *
 * When the decision cannot be made, because the gateway fails or the deadline
 * passes, it fails with the `GatewayFailure` and no verdict exists. A caller
 * does nothing with the text then, because no pattern or list replaces the
 * model. A caller with several texts asks about each in its own request.
 */
export const judge = Effect.fn("nina.judgment.judge")(function* <
  const Names extends readonly [JudgmentName, ...JudgmentName[]],
>(names: Names, text: string) {
  const row = yield* probabilities(names, text);
  return Rec.map(
    Struct.pick(judgments, names),
    ({ threshold }, name) => row[name] >= threshold
  );
});
