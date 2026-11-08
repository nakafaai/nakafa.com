import { ListPlusIcon } from "@hugeicons/core-free-icons";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { partLetter } from "@repo/backend/confect/exams/letters";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
} from "@repo/backend/confect/exams/question";
import { LineWords } from "@repo/design-system/components/ui/line";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Option } from "effect";
import { useTranslations } from "use-intl";
import type { OptionLabel } from "@/components/tenant/exams/answer";
import { OptionRemove, OptionRow } from "@/components/tenant/exams/option";
import { useQuestionPage } from "@/components/tenant/exams/page";
import { ExamDocument } from "@/components/tenant/exams/rich";
import { PartAdd } from "@/components/tenant/exams/sheet";
import {
  cellsKey,
  keyCells,
  withCellLabel,
  withStatementAdded,
  withStatementRemoved,
} from "@/components/tenant/exams/table";
import type { Unstored } from "@/components/tenant/exams/writer";
import { TryoutChoiceTable } from "@/components/tryout/runtime/choice/table";

/** A true or false table, as the page shows it. */
type Table = Extract<Interaction, { kind: "matrix" }>;

/** One statement or column of the table: its ID and its rich text. */
type Part = Table["statements"][number];

/**
 * A true or false question's paper as the student sees it: one table, a row for each numbered statement and a
 * column for each choice, true and false, each row's circles unmarked. The teacher writes each statement in its
 * row, with its remove control at the end of the statement's first line, and may retype a column's header; the key is
 * marked in the teacher's layer (`TableKey`), so the paper carries no mark. A statement that leaves takes its mark out
 * of the key.
 */
export function TableSheet({ table }: { readonly table: Table }) {
  const t = useTranslations("Exams");
  const { chosen, editing, locked, number, question } = useQuestionPage();
  const saved = (side: "columns" | "statements") =>
    Arr.flatMap(question.answers, (answer) =>
      answer.kind === "matrix" ? answer[side] : []
    );

  /** Saves the label a statement's or a column's editor holds. */
  const saveLabel = (partId: string, label: OptionLabel, unstored: Unstored) =>
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
  const addStatement = () => {
    const unique = Effect.runSync(randomUuid);
    editing.saveAnswers((current) => {
      const answers = withStatementAdded(current.answers, unique);
      return {
        ...current,
        answers,
        key: cellsKey(answers, keyCells(current.key)),
      };
    });
  };

  return (
    <div className="grid min-w-0 gap-3">
      <TryoutChoiceTable
        columns={Arr.map(table.columns, (column, index) => ({
          id: column.id,
          label: (
            <OptionRow
              label={labelOf(column, saved("columns"))}
              onSave={(label: OptionLabel, unstored: Unstored) =>
                saveLabel(column.id, label, unstored)
              }
            >
              <LineWords>
                <ExamDocument
                  label={t("column-of", {
                    name: partLetter(table.columns, index),
                    number,
                  })}
                  placeholder={t("column-placeholder")}
                  size="line"
                />
              </LineWords>
            </OptionRow>
          ),
        }))}
        disabled
        label={table.label}
        statementLabel={t("statement-placeholder")}
        statements={Arr.map(table.statements, (statement, index) => ({
          id: statement.id,
          label: (
            <OptionRow
              label={labelOf(statement, saved("statements"))}
              onSave={(label: OptionLabel, unstored: Unstored) =>
                saveLabel(statement.id, label, unstored)
              }
            >
              <LineWords>
                <ExamDocument
                  label={t("statement-of", { name: index + 1, number })}
                  placeholder={t("statement-placeholder")}
                  size="line"
                />
              </LineWords>
              {table.statements.length > CHOICE_OPTIONS_MIN ? (
                <OptionRemove
                  name={t("statement-remove-of", { name: index + 1, number })}
                  onRemove={() => removeStatement(statement.id)}
                />
              ) : null}
            </OptionRow>
          ),
          marked: undefined,
        }))}
      />
      {locked || table.statements.length >= CHOICE_OPTIONS_MAX ? null : (
        <PartAdd
          icon={ListPlusIcon}
          label={t("statement-add")}
          onAdd={addStatement}
          shown={chosen}
        />
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
