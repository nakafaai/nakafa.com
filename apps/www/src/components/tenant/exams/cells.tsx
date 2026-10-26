import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  FieldDescription,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { markedWith } from "@/components/exams/sitting/response";
import { labelText, optionLetter } from "@/components/tenant/exams/answer";
import { keyCells } from "@/components/tenant/exams/table";

/** One cell of a table, as its key holds it: a statement and the column it takes. */
type Cell = Extract<InteractionKey, { kind: "matrix" }>["answers"][number];

/** The props of the key of one true or false table. */
interface TableKeyProps {
  /** Whether the teacher may change the key now. */
  readonly editable: boolean;
  /** The key the page shows, whose cells the toggles start from. */
  readonly keyed: readonly InteractionKey[] | null;
  /** The number of the question, which names each toggle for assistive technology. */
  readonly number: number;
  /** Saves the cells once they mark every statement. */
  readonly onMark: (cells: readonly Cell[]) => void;
  /** The table of the question, as the page shows it. */
  readonly table: Extract<Interaction, { kind: "matrix" }>;
}

/**
 * The key of a true or false table: for each statement, the column it takes, true or false, as a teacher
 * writes the key of a paper. The key saves once every statement is marked, and until then the marks the
 * teacher chose wait on screen.
 */
export function TableKey({
  editable,
  keyed,
  number,
  onMark,
  table,
}: TableKeyProps) {
  const t = useTranslations("Exams");
  // The marks the teacher chose that do not mark every statement yet, which stand for the key until they do.
  const [draft, setDraft] = useState<readonly Cell[] | null>(null);
  // Only the marks of statements and columns the table still holds count.
  const cells = Arr.filter(
    draft ?? keyCells(keyed),
    (cell) =>
      Arr.some(table.statements, (part) => part.id === cell.statement) &&
      Arr.some(table.columns, (part) => part.id === cell.column)
  );

  /** Marks one statement with one column, and saves the marks once they mark every statement. */
  const mark = (statement: string, column: string) => {
    const next = markedWith(table.statements, cells, { column, statement });
    if (next.length === table.statements.length) {
      setDraft(null);
      onMark(next);
      return;
    }
    setDraft(next);
  };

  return (
    <div className="grid gap-2">
      <FieldTitle>{t("answer-key")}</FieldTitle>
      <ol className="grid gap-2">
        {Arr.map(table.statements, (statement, index) => (
          <li
            className="flex items-center justify-between gap-4"
            key={statement.id}
          >
            <span className="text-sm tabular-nums">
              {t("statement-number", { name: index + 1 })}
            </span>
            <ToggleGroup
              aria-label={t("cell-of", { name: index + 1, number })}
              disabled={!editable}
              onValueChange={(value) => {
                if (value !== "") {
                  mark(statement.id, value);
                }
              }}
              type="single"
              value={Option.getOrElse(
                Option.map(
                  Arr.findFirst(
                    cells,
                    (cell) => cell.statement === statement.id
                  ),
                  (cell) => cell.column
                ),
                () => ""
              )}
            >
              {Arr.map(table.columns, (column, at) => (
                <ToggleGroupItem key={column.id} value={column.id}>
                  {labelText(column.label) || optionLetter(at)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </li>
        ))}
      </ol>
      <FieldDescription>{t("cell-hint")}</FieldDescription>
    </div>
  );
}
