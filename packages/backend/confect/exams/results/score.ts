import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { QuestionPoints } from "@repo/backend/confect/exams/question";
import type { Verdict } from "@repo/backend/confect/exams/results/schema";
import { evaluate } from "@repo/backend/confect/response/evaluation";
import type {
  Outcome,
  ResponseSpec,
  Selection,
} from "@repo/backend/confect/response/model";
import { Array as Arr, Option, Result } from "effect";

/** A choice interaction, which a single-answer or a multiple-choice question holds. */
type Choice = Extract<Interaction, { readonly kind: "choice" }>;

/** The key of one choice interaction: the options that are correct for it. */
type ChoiceKey = Extract<InteractionKey, { readonly kind: "choice" }>;

const isChoice = (interaction: Interaction): interaction is Choice =>
  interaction.kind === "choice";

/**
 * The choice that a question answers. A student answers a question of exactly one choice, so a
 * question of any other shape has none, and its answers stay pending.
 */
const answeredChoice = (
  interactions: readonly Interaction[]
): Option.Option<Choice> =>
  interactions.length === 1
    ? Arr.findFirst(interactions, isChoice)
    : Option.none();

/** The key's answer for one choice, or none when the key holds no choice answer for it. */
const choiceKeyOf = (
  key: readonly InteractionKey[],
  interactionId: string
): Option.Option<ChoiceKey> =>
  Arr.findFirst(
    key,
    (answer): answer is ChoiceKey =>
      answer.kind === "choice" && answer.interaction === interactionId
  );

/**
 * The response spec of one choice, with each option marked correct when the key names it. A choice
 * that takes one option is single-choice, and any other choice takes several, so each shape is scored
 * by the rule of the try-outs for it. Evaluation reads no label, so each option's ID stands in for it.
 */
const specOf = (choice: Choice, answer: ChoiceKey): ResponseSpec => {
  const options = Arr.map(choice.options, (option, order) => ({
    isCorrect: Arr.contains(answer.correct, option.id),
    label: option.id,
    optionKey: option.id,
    order,
  }));
  return choice.maxChoices === 1
    ? { kind: "single-choice", options }
    : { kind: "multiple-choice", options };
};

/**
 * The selection that a saved response makes on its choice. An unanswered question makes none, and a
 * single-answer choice takes exactly one option, so a response that names more makes none either.
 */
const selectionOf = (
  choice: Choice,
  response: readonly string[]
): Option.Option<Selection> => {
  if (choice.maxChoices !== 1) {
    return Arr.isReadonlyArrayNonEmpty(response)
      ? Option.some<Selection>({
          kind: "multiple-choice",
          optionKeys: [...response],
        })
      : Option.none();
  }
  return response.length === 1
    ? Option.some<Selection>({ kind: "single-choice", optionKey: response[0] })
    : Option.none();
};

/**
 * The verdict of each outcome. A choice is correct or incorrect, and an outcome that a person judges,
 * which is pending or the partial credit only a rubric earns, is pending.
 */
const VERDICT_OF_STATUS = {
  correct: "correct",
  incorrect: "incorrect",
  partial: "pending",
  pending: "pending",
} satisfies Record<Outcome["status"], Verdict>;

/**
 * Scores one saved response against its question's key with the try-outs' evaluation (`evaluate`, ADR
 * 0031, section 9). An unanswered question, and a response that names no option of its choice, are
 * `incorrect`, as the sitting closes them. A question that holds another shape, a question without a
 * key, or a key with no answer for its choice is `pending`, so a person judges it instead of the server
 * (ADR 0031, section 4).
 */
export function scoreResponse(
  interactions: readonly Interaction[],
  key: readonly InteractionKey[] | null,
  response: readonly string[]
): Verdict {
  const choice = answeredChoice(interactions);
  if (Option.isNone(choice) || key === null) {
    return "pending";
  }
  const answer = choiceKeyOf(key, choice.value.id);
  if (Option.isNone(answer)) {
    return "pending";
  }
  return Option.match(selectionOf(choice.value, response), {
    onNone: () => "incorrect",
    onSome: (selection) =>
      Result.match(evaluate(specOf(choice.value, answer.value), selection), {
        onFailure: () => "incorrect",
        onSuccess: ({ outcome }) => VERDICT_OF_STATUS[outcome.status],
      }),
  });
}

/**
 * The points that one verdict earns: a correct answer earns the weight of its question, and no other
 * verdict earns any. The points of an attempt add up to its score.
 */
export const pointsOf = (
  verdict: Verdict,
  weight: typeof QuestionPoints.Type
): number => (verdict === "correct" ? weight : 0);
