"use client";

import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { type ReactNode, useId } from "react";
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

/** How one cell reads: open, the key's column once answers show, or the learner's mark that misses it. */
const choiceCell = cva(
  "flex min-h-12 items-center justify-center border-t px-2 py-3",
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
 * column for each choice, true and false, with one mark per row. Each row is a radio group named by its
 * statement, and each radio by its column's header, so a screen reader reads the statement and the
 * choice. Without `onMark` the table is only read, as a review reads it, and a statement with its key
 * shows the key's column and a mark that misses it.
 */
export function TryoutChoiceTable({
  columns,
  disabled,
  labelledBy,
  onMark,
  statementLabel,
  statements,
}: {
  readonly columns: readonly ChoiceTableColumn[];
  readonly disabled: boolean;
  /** The id of the heading that names the question; the try-out's answer label when none is given. */
  readonly labelledBy?: string;
  readonly onMark?: (statement: string, column: string) => void;
  /** The header of the statements' column; the try-out's own when none is given. */
  readonly statementLabel?: string;
  readonly statements: readonly ChoiceTableStatement[];
}) {
  const t = useTranslations("Tryouts");
  const id = useId();

  return (
    <fieldset
      aria-labelledby={labelledBy ?? `${id}-answer`}
      className="m-0 grid min-w-0 overflow-hidden rounded-xl border p-0"
      style={{
        gridTemplateColumns: `auto minmax(0, 1fr) repeat(${columns.length}, minmax(4.5rem, auto))`,
      }}
    >
      {labelledBy === undefined ? (
        <span className="sr-only" id={`${id}-answer`}>
          {t("answer")}
        </span>
      ) : null}
      <div className="col-span-full grid grid-cols-subgrid bg-muted/50 font-medium text-sm">
        <div aria-hidden="true" className="py-3 pl-4" />
        <div className="px-3 py-3">{statementLabel ?? t("statement")}</div>
        {Arr.map(columns, (column) => (
          <div
            className="px-2 py-3 text-center"
            id={`${id}-${column.id}`}
            key={column.id}
          >
            {column.label}
          </div>
        ))}
      </div>
      {Arr.map(statements, (statement, index) => (
        <ChoiceTableRow
          columns={columns}
          disabled={disabled}
          headerId={id}
          key={statement.id}
          number={index + 1}
          onMark={onMark}
          statement={statement}
        />
      ))}
    </fieldset>
  );
}

/** One statement's row: its number, its text, and one radio under each column's header. */
function ChoiceTableRow({
  columns,
  disabled,
  headerId,
  number,
  onMark,
  statement,
}: {
  readonly columns: readonly ChoiceTableColumn[];
  readonly disabled: boolean;
  readonly headerId: string;
  readonly number: number;
  readonly onMark: ((statement: string, column: string) => void) | undefined;
  readonly statement: ChoiceTableStatement;
}) {
  const t = useTranslations("Tryouts");
  const labelId = `${headerId}-${statement.id}-label`;

  return (
    <RadioGroup
      aria-labelledby={labelId}
      className="col-span-full grid grid-cols-subgrid gap-0"
      disabled={disabled || onMark === undefined}
      onValueChange={(column) => onMark?.(statement.id, column)}
      value={statement.marked ?? ""}
    >
      <span className="flex items-start border-t py-3 pl-4 font-medium tabular-nums">
        {number}.
      </span>
      <div className="min-w-0 border-t px-3 py-3" id={labelId}>
        {statement.label}
      </div>
      {Arr.map(columns, (column) => (
        <div
          className={choiceCell({ tone: toneOf(statement, column.id) })}
          key={column.id}
        >
          <Radio
            aria-labelledby={`${headerId}-${column.id}`}
            className="cursor-pointer"
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
