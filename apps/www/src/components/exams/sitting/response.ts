import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { Array as Arr, Option, Result } from "effect";

/** The choice interaction, whose response is the options the student chose. */
export type Choice = Extract<Interaction, { readonly kind: "choice" }>;

/** A written interaction: a short answer's text entry or an essay's long text, whose response is text. */
export type Written = Extract<
  Interaction,
  { readonly kind: "extendedText" | "textEntry" }
>;

/**
 * The written interaction of a question, when the question holds exactly one interaction and that
 * interaction is a text entry or a long text, as a short answer and an essay do. This is the rule that
 * the server applies.
 */
export function writtenOf(
  interactions: readonly Interaction[]
): Option.Option<Written> {
  if (interactions.length !== 1) {
    return Option.none();
  }
  return Arr.findFirst(
    interactions,
    (interaction): interaction is Written =>
      interaction.kind === "textEntry" || interaction.kind === "extendedText"
  );
}

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
 * The option that a digit key picks: the option at `index` of a single choice. A question of
 * another shape, or a multiple choice, has no option that a digit key picks.
 */
export function pickedOption(
  interactions: readonly Interaction[],
  index: number
): Option.Option<string> {
  return Option.flatMap(choiceOf(interactions), (choice) =>
    choice.maxChoices === 1
      ? Option.map(Arr.get(choice.options, index), (option) => option.id)
      : Option.none()
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

/** The match interaction, whose response is the pairs the student made. */
export type MatchPart = Extract<Interaction, { readonly kind: "match" }>;

/**
 * The match of a question, when the question holds exactly one interaction and that interaction is a
 * match, as a matching question does. This is the rule that the server applies.
 */
export function pairingOf(
  interactions: readonly Interaction[]
): Option.Option<MatchPart> {
  if (interactions.length !== 1) {
    return Option.none();
  }
  return Arr.findFirst(
    interactions,
    (interaction): interaction is MatchPart => interaction.kind === "match"
  );
}

/** One pair of a match, as the contract names it: a statement and the answer the student or the key gives it. */
type Pair = Extract<InteractionKey, { kind: "match" }>["pairs"][number];

/**
 * The pairs once one statement takes one answer: the statement's earlier pair is replaced, and a statement
 * that held this answer gives it up, since each answer pairs one statement. The pairs keep the order of the
 * match's statements, and a pair of a statement the match does not hold is dropped.
 */
export function pairedWith(
  sources: readonly Pick<MatchPart["sources"][number], "id">[],
  pairs: readonly Pair[],
  next: Pair
): readonly Pair[] {
  const all = Arr.append(
    Arr.filter(
      pairs,
      (pair) => pair.source !== next.source && pair.target !== next.target
    ),
    next
  );
  return Arr.filterMap(sources, (source) =>
    Option.match(
      Arr.findFirst(all, (pair) => pair.source === source.id),
      { onNone: () => Result.failVoid, onSome: Result.succeed }
    )
  );
}

/** One cell of a table, as the contract names it: a statement and the column the student or the key gives it. */
type Cell = Extract<InteractionKey, { kind: "matrix" }>["answers"][number];

/**
 * The cells once one statement takes one column: the statement's earlier cell is replaced, and every
 * other statement keeps its own, in the order of the table's statements. A cell of a statement the table
 * does not hold is dropped.
 */
export function markedWith(
  statements: readonly Pick<TablePart["statements"][number], "id">[],
  cells: readonly Cell[],
  next: Cell
): readonly Cell[] {
  return Arr.filterMap(statements, (statement) =>
    statement.id === next.statement
      ? Result.succeed(next)
      : Option.match(
          Arr.findFirst(cells, (cell) => cell.statement === statement.id),
          { onNone: () => Result.failVoid, onSome: Result.succeed }
        )
  );
}

/** The table interaction, whose response is the cells the student marked. */
export type TablePart = Extract<Interaction, { readonly kind: "matrix" }>;

/**
 * The table of a question, when the question holds exactly one interaction and that interaction is a
 * table, as a true or false table does. This is the rule that the server applies.
 */
export function tableOf(
  interactions: readonly Interaction[]
): Option.Option<TablePart> {
  if (interactions.length !== 1) {
    return Option.none();
  }
  return Arr.findFirst(
    interactions,
    (interaction): interaction is TablePart => interaction.kind === "matrix"
  );
}
