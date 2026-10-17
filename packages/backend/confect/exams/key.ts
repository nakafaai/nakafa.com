import { hasUniqueIds } from "@nakafa/aksara-contracts/assessment/identity";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { Array as Arr } from "effect";

/**
 * Whether one answer fits one interaction. A choice takes an answer of its own kind,
 * whose correct options are options of that choice, and at most `maxChoices` of them.
 * Any other kind of interaction fits no answer, because a question takes only choices.
 */
const answerFits = (interaction: Interaction, answer: InteractionKey) =>
  interaction.kind === "choice" &&
  answer.kind === "choice" &&
  answer.correct.length <= interaction.maxChoices &&
  Arr.every(answer.correct, (id) =>
    Arr.some(interaction.options, (option) => option.id === id)
  );

/**
 * Whether an answer key fits the interactions of its question. Each interaction has
 * exactly one answer that fits it. Because the interactions have distinct IDs and each
 * holds one answer, the key has one answer for each interaction and names no other.
 * The contract checks the shape of each key, but not that a key names this question's
 * options, so this check decides that.
 */
export const keyFits = (
  interactions: readonly Interaction[],
  key: readonly InteractionKey[]
): boolean =>
  hasUniqueIds(interactions) &&
  key.length === interactions.length &&
  Arr.every(interactions, (interaction) => {
    const answers = Arr.filter(
      key,
      (answer) => answer.interaction === interaction.id
    );
    return (
      answers.length === 1 &&
      Arr.every(answers, (answer) => answerFits(interaction, answer))
    );
  });
