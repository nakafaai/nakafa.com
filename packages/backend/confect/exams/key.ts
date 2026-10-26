import {
  hasDistinctIds,
  hasUniqueIds,
} from "@nakafa/aksara-contracts/assessment/identity";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type {
  ExamCell,
  ExamPair,
} from "@repo/backend/confect/exams/sittings/response";
import { Array as Arr } from "effect";

/**
 * Whether pairs fit a match one to one: each pair joins one of its statements to one of its answers,
 * and no statement or answer is paired twice, as each is paired at most once. A key pairs every
 * statement, and a student's response may leave some unpaired.
 */
export const pairsFit = (
  match: Extract<Interaction, { kind: "match" }>,
  pairs: readonly ExamPair[]
) =>
  hasDistinctIds(Arr.map(pairs, (pair) => pair.source)) &&
  hasDistinctIds(Arr.map(pairs, (pair) => pair.target)) &&
  Arr.every(
    pairs,
    (pair) =>
      Arr.some(match.sources, (part) => part.id === pair.source) &&
      Arr.some(match.targets, (part) => part.id === pair.target)
  );

/**
 * Whether cells fit a table: each cell marks one of its statements with one of its columns, and no
 * statement is marked twice. A key marks every statement, and a student's response may leave some blank.
 */
export const cellsFit = (
  matrix: Extract<Interaction, { kind: "matrix" }>,
  cells: readonly ExamCell[]
) =>
  hasDistinctIds(Arr.map(cells, (cell) => cell.statement)) &&
  Arr.every(
    cells,
    (cell) =>
      Arr.some(matrix.statements, (part) => part.id === cell.statement) &&
      Arr.some(matrix.columns, (part) => part.id === cell.column)
  );

/**
 * Whether one answer fits one interaction. A choice takes an answer of its own kind,
 * whose correct options are options of that choice, and at most `maxChoices` of them,
 * a text entry takes accepted answers of its own kind, a match takes pairs that pair
 * every statement once (`pairsFit`), and a table takes cells that mark every statement once
 * (`cellsFit`). Any other kind of interaction fits no answer.
 */
const answerFits = (interaction: Interaction, answer: InteractionKey) => {
  if (interaction.kind === "textEntry") {
    return answer.kind === "textEntry";
  }
  if (interaction.kind === "matrix") {
    return (
      answer.kind === "matrix" &&
      answer.answers.length === interaction.statements.length &&
      cellsFit(interaction, answer.answers)
    );
  }
  if (interaction.kind === "match") {
    return (
      answer.kind === "match" &&
      answer.pairs.length === interaction.sources.length &&
      pairsFit(interaction, answer.pairs)
    );
  }
  return (
    interaction.kind === "choice" &&
    answer.kind === "choice" &&
    answer.correct.length <= interaction.maxChoices &&
    Arr.every(answer.correct, (id) =>
      Arr.some(interaction.options, (option) => option.id === id)
    )
  );
};

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
