import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  chosenOptions,
  type ExamResponse,
  markedCells,
} from "@repo/backend/confect/assessment/response";
import { RadioGroup } from "@repo/design-system/components/ui/radio-group";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import {
  type Choice,
  markedWith,
  type TablePart,
  toggleOption,
} from "@/components/exams/sitting/response";
import {
  TryoutSelectableMultipleChoice,
  TryoutSelectableRadioOption,
} from "@/components/tryout/runtime/choice/surface";
import { TryoutChoiceTable } from "@/components/tryout/runtime/choice/table";
import { optionLabelId } from "@/components/tryout/runtime/response/id";
import { TryoutResponseLabel } from "@/components/tryout/runtime/response/label";

/** Props of one response field set: `value` holds the question's interaction, its response, and the save. */
interface TryoutResponseFieldsProps {
  value: {
    /** The key's answer, which marks each option or statement while it stays answerable, as a demo shows it. */
    readonly answer?: InteractionKey | undefined;
    readonly id: string;
    readonly interaction: Interaction;
    readonly locked: boolean;
    readonly onChange: (response: ExamResponse | null) => void;
    readonly response: ExamResponse | null;
  };
}

/**
 * Renders the one interaction of a question as the learner answers it: a choice that takes one option as
 * radios, a choice that takes more as checks, and a matrix as one table with a row per statement. The 2.0
 * corpus compiles only these two kinds, so any other renders nothing.
 */
export function TryoutResponseFields({ value }: TryoutResponseFieldsProps) {
  const { interaction } = value;
  if (interaction.kind === "matrix") {
    return <MatrixFields table={interaction} value={value} />;
  }
  if (interaction.kind !== "choice") {
    return null;
  }
  return interaction.maxChoices === 1 ? (
    <SingleChoiceFields choice={interaction} value={value} />
  ) : (
    <MultipleChoiceFields choice={interaction} value={value} />
  );
}

function SingleChoiceFields({
  choice,
  value,
}: {
  choice: Choice;
  value: TryoutResponseFieldsProps["value"];
}) {
  const t = useTranslations("Tryouts");
  const { id, locked, onChange, response } = value;
  const selected = Option.getOrElse(
    Arr.head(chosenOptions(response ?? [])),
    () => ""
  );
  const labelId = `${id}-answer-label`;
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="sr-only" id={labelId}>
        {t("answer")}
      </legend>
      <RadioGroup
        aria-labelledby={labelId}
        className="grid grid-cols-1 gap-2 md:grid-cols-2"
        disabled={locked}
        onValueChange={(optionId) => onChange([optionId])}
        value={selected}
      >
        {Arr.map(choice.options, (option) => (
          <TryoutSelectableRadioOption
            appearance={revealedAppearance(value.answer, option.id)}
            checked={selected === option.id}
            disabled={locked}
            id={optionLabelId(id, option.id)}
            key={option.id}
            label={
              <TryoutResponseLabel
                correctness={revealedCorrectness(value.answer, option.id)}
                document={option.label}
              />
            }
            value={option.id}
          />
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function MultipleChoiceFields({
  choice,
  value,
}: {
  choice: Choice;
  value: TryoutResponseFieldsProps["value"];
}) {
  const t = useTranslations("Tryouts");
  const { id, locked, onChange, response } = value;
  const chosen = chosenOptions(response ?? []);
  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-2 border-0 p-0 md:grid-cols-2">
      <legend className="sr-only">{t("answer")}</legend>
      {Arr.map(choice.options, (option) => (
        <TryoutSelectableMultipleChoice
          appearance={revealedAppearance(value.answer, option.id)}
          checked={Arr.contains(chosen, option.id)}
          disabled={locked}
          id={optionLabelId(id, option.id)}
          key={option.id}
          label={
            <TryoutResponseLabel
              correctness={revealedCorrectness(value.answer, option.id)}
              document={option.label}
            />
          }
          onCheckedChange={(checked) => {
            const next = toggleOption(
              chosen,
              option.id,
              checked,
              choice.maxChoices
            );
            // A choice with no option checked holds no answer, so it clears.
            onChange(Arr.isReadonlyArrayNonEmpty(next) ? next : null);
          }}
        />
      ))}
    </fieldset>
  );
}

/** A matrix as a printed exam sets it: one table, a row per statement and a column per choice. */
function MatrixFields({
  table,
  value,
}: {
  table: TablePart;
  value: TryoutResponseFieldsProps["value"];
}) {
  const { locked, onChange, response } = value;
  const cells = markedCells(response ?? []);
  return (
    <TryoutChoiceTable
      columns={Arr.map(table.columns, (column) => ({
        id: column.id,
        label: <TryoutResponseLabel document={column.label} />,
      }))}
      disabled={locked}
      onMark={(statement, column) =>
        onChange({
          cells: markedWith(table.statements, cells, { column, statement }),
        })
      }
      statements={Arr.map(table.statements, (statement) => ({
        correct:
          value.answer?.kind === "matrix"
            ? Option.getOrUndefined(
                Option.map(
                  Arr.findFirst(
                    value.answer.answers,
                    (cell) => cell.statement === statement.id
                  ),
                  (cell) => cell.column
                )
              )
            : undefined,
        id: statement.id,
        label: <TryoutResponseLabel document={statement.label} />,
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

/** How an option shows while it stays answerable: open, or marked by the key once it is revealed. */
function revealedAppearance(
  answer: InteractionKey | undefined,
  optionId: string
) {
  return answer?.kind === "choice"
    ? ({
        isCorrect: Arr.contains(answer.correct, optionId),
        kind: "revealed",
      } as const)
    : ({ kind: "selectable" } as const);
}

/** Whether an option is correct, once the key is revealed. */
function revealedCorrectness(
  answer: InteractionKey | undefined,
  optionId: string
) {
  return answer?.kind === "choice"
    ? Arr.contains(answer.correct, optionId)
    : undefined;
}
