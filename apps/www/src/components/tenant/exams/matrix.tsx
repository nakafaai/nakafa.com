import { ListPlusIcon } from "@hugeicons/core-free-icons";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Button } from "@repo/design-system/components/ui/button";
import { FieldDescription } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Radio,
  RadioGroup,
} from "@repo/design-system/components/ui/radio-group";
import { Array as Arr, Option } from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import { markedWith } from "@/components/exams/sitting/response";
import {
  type OptionLabel,
  optionLetter,
} from "@/components/tenant/exams/answer";
import type { QuestionEditing } from "@/components/tenant/exams/edits";
import type { Question } from "@/components/tenant/exams/optimistic";
import { OptionRow } from "@/components/tenant/exams/option";
import { ExamDocument } from "@/components/tenant/exams/rich";
import {
  PaperTable,
  PaperTableHead,
  PaperTableHeader,
  PaperTableMark,
  PaperTableNumber,
  PaperTableStatement,
} from "@/components/tenant/exams/sheet";
import {
  cellsKey,
  keyCells,
  withCellLabel,
  withStatementAdded,
  withStatementRemoved,
} from "@/components/tenant/exams/table";

/** A true or false table, as the page shows it. */
type Table = Extract<Interaction, { kind: "matrix" }>;

/** One cell of the key: a statement and the column it takes. */
type Cell = Extract<InteractionKey, { kind: "matrix" }>["answers"][number];

/** One statement or column of the table: its ID and its rich text. */
type Part = Table["statements"][number];

/** The props of a true or false table on its question's paper. */
interface TableSheetProps {
  /** Whether the page is the chosen one, which shows the action that adds a statement. */
  readonly chosen: boolean;
  readonly editing: QuestionEditing;
  /** Whether the exam is locked, so the table takes no change. */
  readonly frozen: boolean;
  /** The number of the question, which names each editor and mark for assistive technology. */
  readonly number: number;
  /** The question as the server holds it, whose labels each editor starts from. */
  readonly question: Question;
  readonly table: Table;
}

/**
 * A true or false question's paper as the student sees it: one table, a row for each numbered statement and a
 * column for each choice, true and false. The teacher writes each statement in its row, may retype a column's
 * header, and marks the key in the table itself, one choice per row. The key saves once every statement is marked;
 * until then the marks wait on screen. A statement that leaves takes its mark out of the key.
 */
export function TableSheet({
  chosen,
  editing,
  frozen,
  number,
  question,
  table,
}: TableSheetProps) {
  const t = useTranslations("Exams");
  const id = useId();
  // The marks that do not mark every statement yet, which stand for the key until they do.
  const [draft, setDraft] = useState<readonly Cell[] | null>(null);
  const cells = Arr.filter(
    draft ?? keyCells(editing.displayed.key),
    (cell) =>
      Arr.some(table.statements, (part) => part.id === cell.statement) &&
      Arr.some(table.columns, (part) => part.id === cell.column)
  );
  const saved = (side: "columns" | "statements") =>
    Arr.flatMap(question.answers, (answer) =>
      answer.kind === "matrix" ? answer[side] : []
    );

  /** Marks one statement with one column, and saves the marks once they mark every statement. */
  const mark = (statement: string, column: string) => {
    const next = markedWith(table.statements, cells, { column, statement });
    if (next.length === table.statements.length) {
      setDraft(null);
      editing.setCells(next);
      return;
    }
    setDraft(next);
  };

  /** Saves the label a statement's or a column's editor holds. */
  const saveLabel = (
    partId: string,
    label: OptionLabel,
    unstored: () => void
  ) =>
    editing.saveAnswers(
      (current) => ({
        ...current,
        answers: withCellLabel(current.answers, partId, label),
      }),
      unstored
    );

  /** Removes a statement and its mark from the key. */
  const removeStatement = (partId: string) =>
    editing.saveAnswers((current) => {
      const answers = withStatementRemoved(current.answers, partId);
      return {
        ...current,
        answers,
        key: cellsKey(
          answers,
          Arr.filter(keyCells(current.key), (cell) => cell.statement !== partId)
        ),
      };
    });

  /** Adds an empty statement at the end, which the key waits on. */
  const addStatement = () =>
    editing.saveAnswers((current) => {
      const answers = withStatementAdded(current.answers);
      return {
        ...current,
        answers,
        key: cellsKey(answers, keyCells(current.key)),
      };
    });

  return (
    <div className="grid min-w-0 gap-3">
      <PaperTable columns={table.columns.length}>
        <PaperTableHead heading={t("match-statements")}>
          {Arr.map(table.columns, (column, index) => (
            <PaperTableHeader id={`${id}-${column.id}`} key={column.id}>
              <OptionRow
                label={labelOf(column, saved("columns"))}
                locked={frozen}
                onRemove={null}
                onSave={(label: OptionLabel, unstored: () => void) =>
                  saveLabel(column.id, label, unstored)
                }
                removeName=""
              >
                <ExamDocument
                  label={t("column-of", { name: optionLetter(index), number })}
                  placeholder={t("column-placeholder")}
                  size="line"
                />
              </OptionRow>
            </PaperTableHeader>
          ))}
        </PaperTableHead>
        {Arr.map(table.statements, (statement, index) => (
          <RadioGroup
            aria-label={t("cell-of", { name: index + 1, number })}
            className="col-span-full grid grid-cols-subgrid gap-0"
            disabled={frozen}
            key={statement.id}
            onValueChange={(column: string) => mark(statement.id, column)}
            value={Option.getOrElse(
              Option.map(
                Arr.findFirst(cells, (cell) => cell.statement === statement.id),
                (cell) => cell.column
              ),
              () => ""
            )}
          >
            <PaperTableNumber number={index + 1} />
            <PaperTableStatement>
              <OptionRow
                label={labelOf(statement, saved("statements"))}
                locked={frozen}
                onRemove={
                  table.statements.length > CHOICE_OPTIONS_MIN
                    ? () => removeStatement(statement.id)
                    : null
                }
                onSave={(label: OptionLabel, unstored: () => void) =>
                  saveLabel(statement.id, label, unstored)
                }
                removeName={t("statement-remove-of", {
                  name: index + 1,
                  number,
                })}
              >
                <ExamDocument
                  label={t("statement-of", { name: index + 1, number })}
                  placeholder={t("statement-placeholder")}
                  size="line"
                />
              </OptionRow>
            </PaperTableStatement>
            {Arr.map(table.columns, (column) => (
              <PaperTableMark key={column.id}>
                <Radio
                  aria-labelledby={`${id}-${column.id}`}
                  className="cursor-pointer"
                  value={column.id}
                />
              </PaperTableMark>
            ))}
          </RadioGroup>
        ))}
      </PaperTable>
      {frozen || table.statements.length >= CHOICE_OPTIONS_MAX ? null : (
        <div className={chosen ? undefined : "invisible"}>
          <Button
            onClick={addStatement}
            size="sm"
            type="button"
            variant="outline"
          >
            <HugeIcons aria-hidden="true" icon={ListPlusIcon} />
            {t("statement-add")}
          </Button>
        </div>
      )}
      <FieldDescription>{t("cell-hint")}</FieldDescription>
    </div>
  );
}

/** The label an editor starts from: the one the server holds, or the one on screen for a new part. */
function labelOf(part: Part, saved: readonly Part[]) {
  return Option.match(
    Arr.findFirst(saved, (item) => item.id === part.id),
    { onNone: () => part.label, onSome: (item) => item.label }
  );
}
