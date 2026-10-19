import { hasDistinctIds } from "@nakafa/aksara-contracts/assessment/identity";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { Verdict } from "@repo/backend/confect/exams/results/schema";
import { Array as Arr, Option } from "effect";

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
 * Whether a saved response names exactly the correct options. The options of a response are
 * distinct, and a key names each correct option once, so equal lengths and mutual membership
 * hold only when the two sets are equal.
 */
const namesCorrectOptions = (
  response: readonly string[],
  correct: readonly string[]
) =>
  hasDistinctIds(response) &&
  response.length === correct.length &&
  Arr.every(response, (optionId) => Arr.contains(correct, optionId));

/**
 * Scores one saved response against its question's key, with the rule of the try-outs for a
 * choice: a single-answer choice is correct when its one option is the correct option, and a
 * multiple-choice question is correct when its selection is exactly the correct options. An
 * unanswered question is `incorrect`, as the sitting closes it. A question that holds another
 * shape, a question without a key, or a key that names no correct option is `pending`, so a person
 * judges it instead of the server (ADR 0031, section 4).
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
  return namesCorrectOptions(response, answer.value.correct)
    ? "correct"
    : "incorrect";
}

/** The points that one verdict earns: a correct answer earns one point, and no other verdict earns any. */
export const pointsOf = (verdict: Verdict): 0 | 1 =>
  verdict === "correct" ? 1 : 0;
