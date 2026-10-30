import { RadioGroup } from "@repo/design-system/components/ui/radio-group";
import { Array as Arr, HashMap, HashSet, Option } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  TryoutSelectableMultipleChoice,
  TryoutSelectableRadioOption,
} from "@/components/tryout/runtime/choice/surface";
import { TryoutChoiceTable } from "@/components/tryout/runtime/choice/table";
import {
  categoryLabelId,
  optionLabelId,
  statementLabelId,
} from "@/components/tryout/runtime/response/id";
import {
  assignCategorySelection,
  type TryoutResponseSelection,
  toggleMultipleChoiceSelection,
} from "@/components/tryout/runtime/response/state";
import type { TryoutRenderableResponseSpec } from "@/components/tryout/runtime/types";

type OnResponseChange = (selection: TryoutResponseSelection | null) => void;

/** Props of one response field set: `value` holds the response and the callbacks it drives. */
export interface TryoutResponseFieldsProps {
  value: {
    readonly id: string;
    readonly locked: boolean;
    readonly onChange: OnResponseChange;
    /** Label of one response option or statement, marked correct or not once revealed. */
    readonly renderLabel: (value: {
      readonly correctness?: boolean | undefined;
      readonly id: string;
      readonly label: string;
    }) => ReactNode;
    readonly responseSpec: TryoutRenderableResponseSpec;
    readonly revealAnswers?: boolean;
    readonly selection: TryoutResponseSelection | null;
  };
}

/** Renders every response kind through one persistence-neutral surface. */
export function TryoutResponseFields({ value }: TryoutResponseFieldsProps) {
  const t = useTranslations("Tryouts");
  const answerLabel = t("answer");
  if (value.responseSpec.kind === "single-choice") {
    return <SingleChoiceFields answerLabel={answerLabel} value={value} />;
  }
  if (value.responseSpec.kind === "multiple-choice") {
    return <MultipleChoiceFields answerLabel={answerLabel} value={value} />;
  }
  return <CategoryFields value={value} />;
}

function SingleChoiceFields({
  answerLabel,
  value,
}: {
  answerLabel: string;
  value: TryoutResponseFieldsProps["value"];
}) {
  const { id, locked, onChange, responseSpec, selection } = value;
  if (responseSpec.kind !== "single-choice") {
    return null;
  }
  const selected =
    selection?.kind === "single-choice" ? selection.optionKey : "";
  const labelId = `${id}-answer-label`;
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="sr-only" id={labelId}>
        {answerLabel}
      </legend>
      <RadioGroup
        aria-labelledby={labelId}
        className="grid grid-cols-1 gap-2 md:grid-cols-2"
        disabled={locked}
        onValueChange={(optionKey) =>
          onChange({ kind: "single-choice", optionKey })
        }
        value={selected}
      >
        {Arr.map(responseSpec.options, (option) => (
          <TryoutSelectableRadioOption
            appearance={previewAppearance(
              value.revealAnswers,
              option.isCorrect
            )}
            checked={selected === option.optionKey}
            disabled={locked}
            id={optionLabelId(id, option.optionKey)}
            key={option.optionKey}
            label={value.renderLabel({
              correctness: previewCorrectness(
                value.revealAnswers,
                option.isCorrect
              ),
              id: optionLabelId(id, option.optionKey),
              label: option.label,
            })}
            value={option.optionKey}
          />
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function MultipleChoiceFields({
  answerLabel,
  value,
}: {
  answerLabel: string;
  value: TryoutResponseFieldsProps["value"];
}) {
  const { id, locked, onChange, responseSpec, selection } = value;
  if (responseSpec.kind !== "multiple-choice") {
    return null;
  }
  const selected = HashSet.fromIterable(
    selection?.kind === "multiple-choice" ? selection.optionKeys : []
  );
  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-2 border-0 p-0 md:grid-cols-2">
      <legend className="sr-only">{answerLabel}</legend>
      {Arr.map(responseSpec.options, (option) => (
        <TryoutSelectableMultipleChoice
          appearance={previewAppearance(value.revealAnswers, option.isCorrect)}
          checked={HashSet.has(selected, option.optionKey)}
          disabled={locked}
          id={optionLabelId(id, option.optionKey)}
          key={option.optionKey}
          label={value.renderLabel({
            correctness: previewCorrectness(
              value.revealAnswers,
              option.isCorrect
            ),
            id: optionLabelId(id, option.optionKey),
            label: option.label,
          })}
          onCheckedChange={() =>
            onChange(
              toggleMultipleChoiceSelection(
                { responseSpec, selection },
                option.optionKey
              )
            )
          }
        />
      ))}
    </fieldset>
  );
}

/** A true or false response as a printed exam sets it: one table, a row per statement and a column per category. */
function CategoryFields({
  value,
}: {
  value: TryoutResponseFieldsProps["value"];
}) {
  const { id, locked, onChange, responseSpec, selection } = value;
  if (responseSpec.kind !== "category") {
    return null;
  }
  const assigned = HashMap.fromIterable(
    selection?.kind === "category"
      ? Arr.map(selection.assignments, (assignment) => [
          assignment.statementKey,
          assignment.categoryKey,
        ])
      : []
  );
  return (
    <TryoutChoiceTable
      columns={Arr.map(responseSpec.categories, (category) => ({
        id: category.categoryKey,
        label: value.renderLabel({
          id: categoryLabelId(id, category.categoryKey),
          label: category.label,
        }),
      }))}
      disabled={locked}
      onMark={(statementKey, categoryKey) =>
        onChange(
          assignCategorySelection(
            { responseSpec, selection },
            statementKey,
            categoryKey
          )
        )
      }
      statements={Arr.map(responseSpec.statements, (statement) => ({
        correct: value.revealAnswers ? statement.correctCategoryKey : undefined,
        id: statement.statementKey,
        label: value.renderLabel({
          id: statementLabelId(id, statement.statementKey),
          label: statement.label,
        }),
        marked: Option.getOrUndefined(
          HashMap.get(assigned, statement.statementKey)
        ),
      }))}
    />
  );
}

function previewAppearance(
  revealAnswers: boolean | undefined,
  isCorrect: boolean | undefined
) {
  return revealAnswers && isCorrect !== undefined
    ? ({ isCorrect, kind: "revealed" } as const)
    : ({ kind: "selectable" } as const);
}

function previewCorrectness(
  revealAnswers: boolean | undefined,
  isCorrect: boolean | undefined
) {
  return revealAnswers ? isCorrect : undefined;
}
