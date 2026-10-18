import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { Array as Arr, Option } from "effect";

/** The choice interaction, the one kind that a student's response answers. */
export type Choice = Extract<Interaction, { readonly kind: "choice" }>;

/**
 * The choice of a question, when the question holds exactly one interaction and that interaction
 * is a choice. Any other question takes no response, so the screen offers it no option. This is
 * the rule that the server applies, so the screen never offers an option the server refuses.
 */
export function choiceOf(
  interactions: readonly Interaction[]
): Option.Option<Choice> {
  if (interactions.length !== 1) {
    return Option.none();
  }
  return Arr.findFirst(
    interactions,
    (interaction): interaction is Choice => interaction.kind === "choice"
  );
}

/**
 * The response after one option of a multiple choice is checked or unchecked. Checking adds the
 * option while the response holds fewer options than the choice takes, and unchecking removes it.
 * A check beyond the maximum leaves the response as it was.
 */
export function toggleOption(
  response: readonly string[],
  optionId: string,
  checked: boolean,
  maxChoices: number
): readonly string[] {
  if (!checked) {
    return Arr.filter(response, (id) => id !== optionId);
  }
  if (Arr.contains(response, optionId) || response.length >= maxChoices) {
    return response;
  }
  return Arr.append(response, optionId);
}
