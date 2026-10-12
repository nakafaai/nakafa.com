import { Gateway } from "@repo/backend/confect/gateway/handle";
import { boundText } from "@repo/backend/confect/nina/budget";
import {
  type JudgmentName,
  judgments,
} from "@repo/backend/confect/nina/judgment/catalog";
import { Array as Arr, Effect, Record as Rec, Struct } from "effect";

/** Tokens of one text that the decision model reads. */
const TEXT_TOKENS = 1000;

/** The question that asks one judgment about one text of a decision. */
function questionId(name: JudgmentName, index: number) {
  return `${name}.${index}`;
}

/**
 * What the decision model reads. One text goes as it is. Several texts go each
 * under its number, so that a question can name the text it is about.
 */
function stateOf(texts: readonly string[]) {
  return texts.length === 1
    ? texts[0]
    : Arr.map(texts, (text, index) => ({
        text: `Text ${index + 1}:\n${text}`,
        type: "text" as const,
      }));
}

/** The instructions of a question, which name their text when the decision has several. */
function instructionsOf(name: JudgmentName, index: number, several: boolean) {
  const { instructions } = judgments[name];
  return several
    ? `About text ${index + 1} only: ${instructions}`
    : instructions;
}

/**
 * The probability that each named judgment is true of each text, one record
 * for each text in the order given. Every question about every text goes to the
 * decision model in one request. A text is cut to what the model reads, and no
 * text means no request.
 *
 * Only the command that measures the judgments against a labelled set reads
 * these numbers (`judgment/measure`). Everything else asks `judge`, so that no
 * caller sees a probability.
 */
export const probabilities = Effect.fn("nina.judgment.probabilities")(
  function* <const Names extends readonly [JudgmentName, ...JudgmentName[]]>(
    names: Names,
    texts: readonly string[]
  ) {
    if (!Arr.isReadonlyArrayNonEmpty(texts)) {
      return [];
    }
    const several = texts.length > 1;
    const questions = Rec.fromEntries(
      Arr.flatMap(names, (name) =>
        Arr.map(
          texts,
          (_, index) =>
            [
              questionId(name, index),
              {
                instructions: instructionsOf(name, index, several),
                type: judgments[name].type,
              },
            ] as const
        )
      )
    );
    const answers = yield* (yield* Gateway).decide(
      stateOf(
        Arr.map(texts, (text) =>
          boundText(text, TEXT_TOKENS, "The text is shortened.")
        )
      ),
      questions
    );
    const asked = Struct.pick(judgments, names);
    return Arr.map(texts, (_, index) =>
      Rec.map(
        asked,
        (_judgment, name) => answers[questionId(name, index)].probability
      )
    );
  }
);

/**
 * Asks the named judgments about each text, with one decision request for all
 * of them, and answers with one verdict for each text in the order given: a
 * record of the named judgments, each true or false. A judgment is true from
 * the probability its entry names (`judgment/catalog`). The caller never sees
 * a probability, a threshold or a model.
 *
 * When the decision cannot be made, because the gateway fails or the deadline
 * passes, it fails with the `GatewayFailure` and no verdict exists. A caller
 * does nothing with the text then, because no pattern or list replaces the
 * model.
 */
export const judge = Effect.fn("nina.judgment.judge")(function* <
  const Names extends readonly [JudgmentName, ...JudgmentName[]],
>(names: Names, texts: readonly string[]) {
  const rows = yield* probabilities(names, texts);
  const asked = Struct.pick(judgments, names);
  return Arr.map(rows, (row) =>
    Rec.map(asked, ({ threshold }, name) => row[name] >= threshold)
  );
});
