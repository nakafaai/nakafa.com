import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import { CHOICE_OPTIONS_MAX } from "@repo/backend/confect/exams/question";
import { Array as Arr, Option, Result } from "effect";
import {
  emptyLabel,
  type OptionLabel,
  withoutPart,
} from "@/components/tenant/exams/answer";

/** The table interaction, which a true or false table holds. */
type Table = Extract<Interaction, { kind: "matrix" }>;

/** One cell of a table, as its key holds it: a statement and the column it takes. */
type Cell = Extract<InteractionKey, { kind: "matrix" }>["answers"][number];

/** The first table of a question's answers, or none when the answers hold no table. */
export const tableOf = (
  answers: readonly Interaction[]
): Option.Option<Table> =>
  Arr.findFirst(answers, (answer): answer is Table => answer.kind === "matrix");

/** The answers with one table changed by `change`, and every other interaction as it was. */
const changeTable = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  change: (table: Table) => Table
): Arr.NonEmptyArray<Interaction> =>
  Arr.map(answers, (answer) =>
    answer.kind === "matrix" ? change(answer) : answer
  );

/** The answers with the label of one statement or column replaced by the document its editor holds. */
export const withCellLabel = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  partId: string,
  label: OptionLabel
) =>
  changeTable(answers, (table) => ({
    ...table,
    columns: Arr.map(table.columns, (part) =>
      part.id === partId ? { ...part, label } : part
    ),
    statements: Arr.map(table.statements, (part) =>
      part.id === partId ? { ...part, label } : part
    ),
  }));

/**
 * The answers with one empty statement added at the end of each table, unless the table holds the most
 * statements it may. The statement's ID ends in `unique`, which no statement has held, so a mark a student
 * saved never lands on a new statement of an exam that takes edits while its sitting runs (ADR 0031).
 */
export const withStatementAdded = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  unique: string
) =>
  changeTable(answers, (table) =>
    table.statements.length >= CHOICE_OPTIONS_MAX
      ? table
      : {
          ...table,
          statements: [
            ...table.statements,
            { id: `statement-${unique}`, label: emptyLabel() },
          ],
        }
  );

/** The answers with one statement taken out of each table, unless the table holds the fewest it may. */
export const withStatementRemoved = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  statementId: string
) =>
  changeTable(answers, (table) => ({
    ...table,
    statements: withoutPart(table.statements, statementId),
  }));

/** The cells a key marks for a table, or none while the key is absent or marks no table. */
export const keyCells = (
  key: readonly InteractionKey[] | null
): readonly Cell[] =>
  Option.match(
    Arr.findFirst(
      key ?? [],
      (answer): answer is Extract<InteractionKey, { kind: "matrix" }> =>
        answer.kind === "matrix"
    ),
    { onNone: () => [], onSome: (answer) => answer.answers }
  );

/**
 * The key of a table from its cells, once they mark every statement of it, in the order of its
 * statements. A key that marks fewer statements is null, since the server takes only a key that marks
 * every statement, and the teacher's marks wait on screen until then.
 */
export const cellsKey = (
  answers: Arr.NonEmptyReadonlyArray<Interaction>,
  cells: readonly Cell[]
): Arr.NonEmptyArray<InteractionKey> | null =>
  Option.match(tableOf(answers), {
    onNone: () => null,
    onSome: (table) => {
      const ordered = Arr.filterMap(table.statements, (statement) =>
        Option.match(
          Arr.findFirst(cells, (cell) => cell.statement === statement.id),
          { onNone: () => Result.failVoid, onSome: Result.succeed }
        )
      );
      return Arr.isReadonlyArrayNonEmpty(ordered) &&
        ordered.length === table.statements.length
        ? [{ answers: ordered, interaction: table.id, kind: "matrix" }]
        : null;
    },
  });
