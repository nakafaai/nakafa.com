"use client";

import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";
import {
  tableCellVariants,
  tableFrameVariants,
  tableHeadCellVariants,
  tableRowVariants,
} from "@repo/design-system/lib/prose";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { createContext, type ReactNode, use, useId } from "react";
import { useTranslations } from "use-intl";

/** One column of the table, such as true or false, with its header. */
interface ChoiceTableColumn {
  readonly id: string;
  readonly label: ReactNode;
}

/** One statement of the table: its text, the column it is marked with, and the key's column once answers show. */
interface ChoiceTableStatement {
  readonly correct?: string | undefined;
  readonly id: string;
  readonly label: ReactNode;
  readonly marked: string | undefined;
}

/** What every row of one table reads: its columns, the ids of their headers, whether it is only read, and how a mark is saved. */
const ChoiceTableContext = createContext<{
  readonly columns: readonly ChoiceTableColumn[];
  readonly headerId: string;
  readonly locked: boolean;
  readonly onMark: ((statement: string, column: string) => void) | undefined;
} | null>(null);

/**
 * How one choice's cell reads: open, the key's column once answers show, or the learner's mark that misses it.
 * It is the lesson's table cell, at least 3rem tall so the radio in it is easy to press.
 */
const choiceCell = cva(
  tableCellVariants({ className: "flex min-h-12 items-center justify-center" }),
  {
    variants: {
      tone: {
        correct: "bg-success/10",
        open: "",
        wrong: "bg-destructive/10",
      },
    },
    defaultVariants: { tone: "open" },
  }
);

/**
 * A true or false question as a printed exam sets it: one table, a row for each numbered statement and a
 * column for each choice, true and false, with one mark per row. It is drawn as the lesson draws a table,
 * from the table's owner (`lib/prose.ts`): its frame, its header's cells, its body on the muted surface,
 * and its rows and cells with their rules. Each row is a radio group named by its statement, and each
 * radio by its column's header, so a screen reader reads the statement and the choice. Without `onMark`, or while `disabled`, the table is only read, as a review reads it, and a
 * statement with its key shows the key's column and a mark that misses it. Only its radios lock, so the exam
 * editor draws this same table around the editors of its statements and columns, as the student meets it.
 */
export function TryoutChoiceTable({
  columns,
  disabled,
  label,
  onMark,
  statementLabel,
  statements,
}: {
  readonly columns: readonly ChoiceTableColumn[];
  readonly disabled: boolean;
  /** The name of the table's group; the try-out's answer label when none is given. */
  readonly label?: string;
  readonly onMark?: (statement: string, column: string) => void;
  /** The header of the statements' column; the try-out's own when none is given. */
  readonly statementLabel?: string;
  readonly statements: readonly ChoiceTableStatement[];
}) {
  const t = useTranslations("Tryouts");
  const id = useId();
  const locked = disabled || onMark === undefined;

  return (
    <ChoiceTableContext value={{ columns, headerId: id, locked, onMark }}>
      <fieldset
        aria-label={label ?? t("answer")}
        className={tableFrameVariants({ className: "m-0 min-w-0 p-0" })}
        style={{
          gridTemplateColumns: `auto minmax(0, 1fr) repeat(${columns.length}, minmax(min(4.5rem, calc(50% / ${columns.length})), auto))`,
        }}
      >
        <div className="col-span-full grid grid-cols-subgrid border-b">
          <div aria-hidden="true" className={tableHeadCellVariants()} />
          <div
            className={tableHeadCellVariants({
              className: "flex items-center",
            })}
          >
            {statementLabel ?? t("statement")}
          </div>
          {Arr.map(columns, (column) => (
            <div
              className={tableHeadCellVariants({
                className: "flex items-center justify-center text-center",
              })}
              id={`${id}-${column.id}`}
              key={column.id}
            >
              {column.label}
            </div>
          ))}
        </div>
        <div
          className="col-span-full grid grid-cols-subgrid"
          data-slot="table-body"
        >
          {Arr.map(statements, (statement, index) => (
            <ChoiceTableRow
              key={statement.id}
              number={index + 1}
              statement={statement}
            />
          ))}
        </div>
      </fieldset>
    </ChoiceTableContext>
  );
}

/** One statement's row: its number, its text, and one radio under each column's header. */
function ChoiceTableRow({
  number,
  statement,
}: {
  readonly number: number;
  readonly statement: ChoiceTableStatement;
}) {
  const t = useTranslations("Tryouts");
  const table = use(ChoiceTableContext);
  if (table === null) {
    throw new Error("ChoiceTableRow must be used within TryoutChoiceTable");
  }
  const labelId = `${table.headerId}-${statement.id}-label`;

  return (
    <RadioGroup
      aria-labelledby={labelId}
      className={tableRowVariants({
        className: "col-span-full grid grid-cols-subgrid gap-0",
      })}
      disabled={table.locked}
      onValueChange={(column) => table.onMark?.(statement.id, column)}
      value={statement.marked ?? ""}
    >
      <span
        className={tableCellVariants({
          className: "content-center font-medium tabular-nums",
        })}
      >
        {number}.
      </span>
      <div
        className={tableCellVariants({ className: "min-w-0 content-center" })}
        id={labelId}
      >
        {statement.label}
      </div>
      {Arr.map(table.columns, (column) => (
        <div
          className={choiceCell({ tone: toneOf(statement, column.id) })}
          key={column.id}
        >
          <Radio
            aria-labelledby={`${table.headerId}-${column.id}`}
            value={column.id}
          />
          {statement.correct === column.id ? (
            <span className="sr-only">{t("correct")}</span>
          ) : null}
        </div>
      ))}
    </RadioGroup>
  );
}

/** The tone of one cell: the key's column, the learner's mark that misses it, or open. */
function toneOf(statement: ChoiceTableStatement, column: string) {
  if (statement.correct === undefined) {
    return "open";
  }
  if (statement.correct === column) {
    return "correct";
  }
  return statement.marked === column ? "wrong" : "open";
}
