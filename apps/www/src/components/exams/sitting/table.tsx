import { RadioGroup } from "@repo/design-system/components/ui/radio-group";
import { Array as Arr, Option } from "effect";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { SittingDocument } from "@/components/exams/sitting/document";
import { markedWith, type TablePart } from "@/components/exams/sitting/response";
import { TryoutSelectableRadioOption } from "@/components/tryout/runtime/choice/surface";

/**
 * A true or false table as the student reads it: each statement, numbered, with its own pair of choices,
 * true or false, framed as the player frames a choice. Each statement takes one column, and choosing the
 * other moves the mark.
 */
export function SittingTable({
  cells,
  disabled = false,
  labelledBy,
  onMark,
  table,
}: {
  /** The cells the paper holds for the question. */
  readonly cells: readonly { readonly column: string; readonly statement: string }[];
  readonly disabled?: boolean;
  /** The id of the heading that names the question. */
  readonly labelledBy: string;
  /** Saves the cells once the student marks one statement. */
  readonly onMark: (
    cells: readonly { readonly column: string; readonly statement: string }[]
  ) => void;
  readonly table: TablePart;
}) {
  const t = useTranslations("Exams");
  const id = useId();

  return (
    <ol aria-labelledby={labelledBy} className="grid min-w-0 gap-6">
      {Arr.map(table.statements, (statement, index) => (
        <li className="grid gap-3" key={statement.id}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="font-medium tabular-nums">{index + 1}.</span>
            <SittingDocument
              document={statement.label}
              label={table.label}
              size="line"
            />
          </div>
          <RadioGroup
            aria-label={t("statement-number", { name: index + 1 })}
            className="grid grid-cols-2 gap-2"
            onValueChange={(column) =>
              onMark(
                markedWith(table.statements, cells, {
                  column,
                  statement: statement.id,
                })
              )
            }
            value={Option.getOrElse(
              Option.map(
                Arr.findFirst(cells, (cell) => cell.statement === statement.id),
                (cell) => cell.column
              ),
              () => ""
            )}
          >
            {Arr.map(table.columns, (column) => (
              <TryoutSelectableRadioOption
                checked={Arr.some(
                  cells,
                  (cell) =>
                    cell.statement === statement.id && cell.column === column.id
                )}
                disabled={disabled}
                id={`${id}-${statement.id}-${column.id}`}
                key={column.id}
                label={
                  <SittingDocument
                    document={column.label}
                    label={table.label}
                    size="line"
                  />
                }
                value={column.id}
              />
            ))}
          </RadioGroup>
        </li>
      ))}
    </ol>
  );
}
