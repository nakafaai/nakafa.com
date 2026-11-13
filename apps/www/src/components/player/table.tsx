"use client";

import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { LineMark, MarkedLine } from "@repo/design-system/components/ui/line";
import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";
import { useRequired } from "@repo/design-system/hooks/required";
import {
  tableCellVariants,
  tableFrameVariants,
  tableHeadCellVariants,
  tableRowVariants,
} from "@repo/design-system/lib/prose";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import { createContext, type ReactNode, useId } from "react";
import { useTranslations } from "use-intl";
import { getChoiceReviewedTone, toneMark } from "@/components/player/tone";

/** One column of the table, such as true or false, with its header. */
interface ChoiceTableColumn {
  readonly id: string;
  readonly label: ReactNode;
}

/**
 * One statement of the table: its words in their `LineWords`, so they share the first line with the row's number and
 * radios, the column it is marked with, and the key's column once answers show.
 */
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
 * The room of one choice's cell: a radio centred under its column's header while the table is answered, and once
 * the key shows, a tile nearly as wide as the cell, so its tone reads as clearly as an option's line. Its radio
 * stands in a marker band, so it shares the statement's first line with the row's number.
 */
const choiceCell = cva("flex justify-center", {
  defaultVariants: { reviewed: false },
  variants: {
    reviewed: {
      false: "",
      true: "p-1",
    },
  },
});

/**
 * The line inside a cell: open while the table is answered, and once the key shows, a tile in the tone of an
 * option's line, or, for a cell neither marked nor the key, the same room with no outline, so every radio of a
 * column stands on one line.
 */
const cellLine = cva("justify-center", {
  defaultVariants: { tone: "open" },
  variants: {
    tone: {
      chosen: "gap-1 p-1",
      correct: "gap-1 p-1",
      idle: "w-full gap-1 border border-transparent p-1",
      key: "gap-1 p-1",
      open: "",
      wrong: "gap-1 p-1",
    },
  },
});

/**
 * A true or false question as a printed exam sets it: one table, a row for each numbered statement and a
 * column for each choice, true and false, with one mark per row. It is drawn as the lesson draws a table,
 * from the table's owner (`lib/prose.ts`): its frame, its header's cells, its body on the muted surface,
 * and its rows and cells with their rules. Each row is a radio group named by its statement, and each
 * radio by its column's header, so a screen reader reads the statement and the choice. Without `onMark`, or while `disabled`, the table is only read, as a review reads it, and a
 * statement with its key shows the key's column and a mark that misses it. Only its radios lock, each on its own
 * and not through the row's group, so the exam editor draws this same table around the editors of its statements
 * and columns, as the student meets it, and a statement being written never reads as disabled.
 */
export function ChoiceTable({
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
  const t = useTranslations("Player");
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
  const table = useRequired(ChoiceTableContext, "ChoiceTableRow");
  const labelId = `${table.headerId}-${statement.id}-label`;

  return (
    <RadioGroup
      aria-labelledby={labelId}
      className={tableRowVariants({
        className: "col-span-full grid grid-cols-subgrid gap-0",
      })}
      onValueChange={(column) => table.onMark?.(statement.id, column)}
      value={statement.marked ?? ""}
    >
      <div className={tableCellVariants()}>
        <LineMark letter>{number}.</LineMark>
      </div>
      <div className={tableCellVariants({ className: "min-w-0" })} id={labelId}>
        {statement.label}
      </div>
      {Arr.map(table.columns, (column) => (
        <ChoiceTableCell
          column={column.id}
          key={column.id}
          statement={statement}
        />
      ))}
    </RadioGroup>
  );
}

/**
 * One choice's cell: its radio under its column's header, and once the key shows, the tone and the mark an option
 * takes (`getChoiceReviewedTone`, `toneMark`): the learner's mark that earns the key, a mark that
 * misses it, or the key the learner did not mark, which is dashed so it never reads as a mark.
 */
function ChoiceTableCell({
  column,
  statement,
}: {
  readonly column: string;
  readonly statement: ChoiceTableStatement;
}) {
  const t = useTranslations("Player");
  const table = useRequired(ChoiceTableContext, "ChoiceTableCell");
  const reviewed = statement.correct !== undefined;
  const tone = getChoiceReviewedTone({
    checked: statement.marked === column,
    isCorrect: reviewed ? statement.correct === column : undefined,
  });

  return (
    <div className={cn(tableCellVariants(), choiceCell({ reviewed }))}>
      <MarkedLine
        className={cellLine({ tone: reviewed ? tone : "open" })}
        tone={reviewed && tone !== "idle" ? tone : "bare"}
      >
        <LineMark>
          <Radio
            aria-labelledby={`${table.headerId}-${column}`}
            disabled={table.locked}
            value={column}
          />
        </LineMark>
        {reviewed ? (
          <LineMark aria-hidden="true" className="min-w-4">
            {Option.match(toneMark(tone), {
              onNone: () => null,
              onSome: (icon) => <HugeIcons icon={icon} />,
            })}
          </LineMark>
        ) : null}
      </MarkedLine>
      {statement.correct === column ? (
        <span className="sr-only">{t("correct")}</span>
      ) : null}
    </div>
  );
}
