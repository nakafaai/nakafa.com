import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { SittingDocument } from "@/components/exams/sitting/document";
import { usePaperLocked } from "@/components/exams/sitting/lock";
import {
  markedWith,
  type TablePart,
} from "@/components/exams/sitting/response";
import { TryoutChoiceTable } from "@/components/tryout/runtime/choice/table";

/**
 * A true or false table as the student reads it and as a printed exam sets it: a row for each numbered
 * statement and a column for each choice, true and false, as the try-out player draws it. Each statement
 * takes one column, and choosing the other moves the mark.
 */
export function SittingTable({
  cells,
  onMark,
  table,
}: {
  /** The cells the paper holds for the question. */
  readonly cells: readonly {
    readonly column: string;
    readonly statement: string;
  }[];
  /** Saves the cells once the student marks one statement. */
  readonly onMark: (
    cells: readonly { readonly column: string; readonly statement: string }[]
  ) => void;
  readonly table: TablePart;
}) {
  const disabled = usePaperLocked();
  const t = useTranslations("Exams");

  return (
    <TryoutChoiceTable
      columns={Arr.map(table.columns, (column) => ({
        id: column.id,
        label: (
          <SittingDocument
            document={column.label}
            label={table.label}
            size="line"
          />
        ),
      }))}
      disabled={disabled}
      label={table.label}
      onMark={(statement, column) =>
        onMark(markedWith(table.statements, cells, { column, statement }))
      }
      statementLabel={t("statement-placeholder")}
      statements={Arr.map(table.statements, (statement) => ({
        id: statement.id,
        label: (
          <SittingDocument
            document={statement.label}
            label={table.label}
            size="line"
          />
        ),
        marked: Option.getOrUndefined(
          Option.map(
            Arr.findFirst(cells, (cell) => cell.statement === statement.id),
            (cell) => cell.column
          )
        ),
      }))}
    />
  );
}
