import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { matchesAnswerKey } from "@nakafa/aksara-contracts/question/answer";
import type { QuestionPoints } from "@repo/backend/confect/exams/question";
import type { Verdict } from "@repo/backend/confect/exams/results/schema";
import {
  chosenOptions,
  type ExamResponse,
  isAnswered,
  isTextResponse,
} from "@repo/backend/confect/exams/sittings/response";
import { evaluate } from "@repo/backend/confect/response/evaluation";
import type {
  Outcome,
  ResponseSpec,
  Selection,
} from "@repo/backend/confect/response/model";
import { Array as Arr, Option, Result, Schema } from "effect";

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

/** A text entry interaction, which a short answer question holds. */
type TextEntry = Extract<Interaction, { readonly kind: "textEntry" }>;

/** The key of one text entry: the texts it accepts, and how they are compared. */
type TextEntryKey = Extract<InteractionKey, { readonly kind: "textEntry" }>;

/**
 * The language a text key is compared in. A text key compares normalized text and reads no
 * language, unlike a number key, so every delivery language grades it the same.
 */
const TEXT_KEY_LANGUAGE = Schema.decodeSync(DeliveryLanguageSchema)("id");

/**
 * The text entry that a question answers: its one interaction, when that is a text entry. A
 * question of any other shape has none.
 */
const answeredEntry = (
  interactions: readonly Interaction[]
): Option.Option<TextEntry> =>
  interactions.length === 1
    ? Arr.findFirst(
        interactions,
        (interaction): interaction is TextEntry =>
          interaction.kind === "textEntry"
      )
    : Option.none();

/** Whether a question is an essay: its one interaction is a long text, which the teacher scores (K6). */
const isEssay = (interactions: readonly Interaction[]) =>
  interactions.length === 1 &&
  Arr.every(interactions, (interaction) => interaction.kind === "extendedText");

/**
 * Scores one typed response against its text entry's key (K7). A key with no accepted answers for the
 * entry leaves it `pending`. A blank response is `incorrect`, as an unanswered question, a text that one
 * accepted answer matches after the contract's normalization (`matchesAnswerKey`) is `correct`, and any
 * other text is `pending`, so the teacher judges it.
 */
const scoreText = (
  entry: TextEntry,
  key: readonly InteractionKey[],
  response: ExamResponse
): Verdict =>
  Option.match(
    Arr.findFirst(
      key,
      (item): item is TextEntryKey =>
        item.kind === "textEntry" && item.interaction === entry.id
    ),
    {
      onNone: () => "pending",
      onSome: ({ accepted }) => {
        if (!(isTextResponse(response) && isAnswered(response))) {
          return "incorrect";
        }
        return matchesAnswerKey(accepted, response.text, TEXT_KEY_LANGUAGE)
          ? "correct"
          : "pending";
      },
    }
  );

/**
 * Scores one saved response against its question's key. An essay is the teacher's to score by its
 * rubric, so a written essay is `pending` and a blank one `incorrect`, as an unanswered question. A
 * choice is scored with the try-outs'
 * evaluation (`evaluate`, ADR 0031, section 9): an unanswered question, and a response that names no
 * option of its choice, are `incorrect`, as the sitting closes them. A text entry is scored by its
 * accepted answers (`scoreText`). A question that holds another shape, a question without a key, or a
 * key with no answer for its interaction is `pending`, so a person judges it instead of the server
 * (ADR 0031, section 4).
 */
export function scoreResponse(
  interactions: readonly Interaction[],
  key: readonly InteractionKey[] | null,
  response: ExamResponse
): Verdict {
  if (isEssay(interactions)) {
    return isAnswered(response) ? "pending" : "incorrect";
  }
  if (key === null) {
    return "pending";
  }
  const entry = answeredEntry(interactions);
  if (Option.isSome(entry)) {
    return scoreText(entry.value, key, response);
  }
  const choice = answeredChoice(interactions);
  if (Option.isNone(choice)) {
    return "pending";
  }
  const answer = choiceKeyOf(key, choice.value.id);
  if (Option.isNone(answer)) {
    return "pending";
  }
  return Option.match(selectionOf(choice.value, chosenOptions(response)), {
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
