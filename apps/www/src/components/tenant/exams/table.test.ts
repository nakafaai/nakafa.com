import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { tableAnswers } from "@repo/backend/confect/exams/question";
import { Array as Arr, Option } from "effect";
import { emptyLabel } from "@/components/tenant/exams/answer";
import {
  cellsKey,
  keyCells,
  tableOf,
  withCellLabel,
  withStatementAdded,
  withStatementRemoved,
} from "@/components/tenant/exams/table";

/** A new true or false table: three statements and the columns true and false. */
const answers = tableAnswers(["Benar", "Salah"]);
const [table] = answers;

/** A text entry, which is not a table, so a table edit leaves it as it is. */
const entry: Interaction = { id: "entry", kind: "textEntry", label: "Entry" };

/** The label of a part that holds `text` as one paragraph. */
const textOf = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc" as const,
});

/** The cells that mark every statement of the new table. */
const full = [
  { column: "column-1", statement: "statement-1" },
  { column: "column-2", statement: "statement-2" },
  { column: "column-1", statement: "statement-3" },
];

describe("tableOf and withCellLabel", () => {
  it("finds the table of the answers, and none in a text entry", () => {
    expect(tableOf(answers)).toEqual(Option.some(table));
    expect(tableOf([entry])).toEqual(Option.none());
  });

  it("writes the label of a statement or a column, and leaves other interactions", () => {
    const [labelled, other] = withCellLabel(
      withCellLabel([table, entry], "statement-1", textOf("Air mendidih")),
      "column-2",
      textOf("Keliru")
    );
    expect(other).toEqual(entry);
    expect(labelled).toMatchObject({
      columns: [
        { id: "column-1" },
        { id: "column-2", label: textOf("Keliru") },
      ],
      statements: [
        { id: "statement-1", label: textOf("Air mendidih") },
        { id: "statement-2", label: emptyLabel() },
        { id: "statement-3" },
      ],
    });
  });
});

describe("withStatementAdded and withStatementRemoved", () => {
  it("adds an empty statement numbered after the largest, up to five", () => {
    const [added] = withStatementAdded(answers);
    expect(added).toMatchObject({
      statements: [
        { id: "statement-1" },
        { id: "statement-2" },
        { id: "statement-3" },
        { id: "statement-4", label: emptyLabel() },
      ],
    });
    const five = withStatementAdded(withStatementAdded(answers));
    expect(withStatementAdded(five)).toEqual(five);
  });

  it("numbers a new statement from one when no statement ID holds a number", () => {
    const named = [
      {
        ...table,
        statements: [
          { id: "first", label: emptyLabel() },
          { id: "second", label: emptyLabel() },
        ],
      },
    ] as const;
    const [added] = withStatementAdded(named);
    expect(
      Arr.map(
        added.kind === "matrix" ? added.statements : [],
        (part) => part.id
      )
    ).toEqual(["first", "second", "statement-1"]);
  });

  it("removes a statement down to two, and leaves other interactions", () => {
    const two = withStatementRemoved(answers, "statement-2");
    expect(two[0]).toMatchObject({
      statements: [{ id: "statement-1" }, { id: "statement-3" }],
    });
    expect(withStatementRemoved(two, "statement-1")).toEqual(two);
    expect(withStatementRemoved([entry], "statement-1")).toEqual([entry]);
  });
});

describe("cellsKey and keyCells", () => {
  it("keys a table only once every statement is marked, in the order of the statements", () => {
    expect(cellsKey(answers, Arr.take(full, 2))).toBeNull();
    const key = cellsKey(answers, [full[2], full[0], full[1]]);
    expect(key).toEqual([
      { answers: full, interaction: "matrix", kind: "matrix" },
    ]);
    expect(keyCells(key)).toEqual(full);
    expect(keyCells(null)).toEqual([]);
    expect(cellsKey([entry], full)).toBeNull();
  });
});
