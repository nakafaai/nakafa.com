import { ListPlusIcon } from "@hugeicons/core-free-icons";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import {
  letterScript,
  optionLetter,
} from "@repo/backend/confect/exams/letters";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import type { OptionLabel } from "@/components/tenant/exams/answer";
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
 * column for each choice, true and false, each row's circles unmarked. The teacher writes each statement in its
 * row and may retype a column's header; the key is marked in the teacher's layer (`TableKey`), so the paper
 * carries no mark. A statement that leaves takes its mark out of the key.
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
  const tTryouts = useTranslations("Tryouts");
  const saved = (side: "columns" | "statements") =>
    Arr.flatMap(question.answers, (answer) =>
      answer.kind === "matrix" ? answer[side] : []
    );

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
        <PaperTableHead heading={tTryouts("statement")}>
          {Arr.map(table.columns, (column, index) => (
            <PaperTableHeader key={column.id}>
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
                  label={t("column-of", {
                    name: optionLetter(
                      index,
                      letterScript(
                        Arr.map(table.columns, (column) => column.label)
                      )
                    ),
                    number,
                  })}
                  placeholder={t("column-placeholder")}
                  size="line"
                />
              </OptionRow>
            </PaperTableHeader>
          ))}
        </PaperTableHead>
        {Arr.map(table.statements, (statement, index) => (
          <div
            className="col-span-full grid grid-cols-subgrid"
            key={statement.id}
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
              <PaperTableMark key={column.id} />
            ))}
          </div>
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
