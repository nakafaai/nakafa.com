"use client";

import { RadioGroup } from "@repo/design-system/components/ui/radio-group";
import { HashMap, HashSet, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  TryoutSelectableMultipleChoice,
  TryoutSelectableRadioOption,
} from "@/components/tryout/runtime/choice/surface.client";
import {
  categoryLabelId,
  optionLabelId,
  statementLabelId,
} from "@/components/tryout/runtime/response/id";
import {
  assignCategorySelection,
  type TryoutResponseSelection,
  TryoutResponseStateSchema,
  toggleMultipleChoiceSelection,
} from "@/components/tryout/runtime/response/state";

/** Label of one response option or statement, marked correct or not once revealed. */
const TryoutResponseFieldLabelSchema = Schema.Struct({
  correctness: Schema.optional(Schema.Boolean),
  id: Schema.String,
  label: Schema.String,
});
export type TryoutResponseFieldLabel =
  typeof TryoutResponseFieldLabelSchema.Type;

/** Response data one field set renders; its callbacks arrive as separate props. */
const TryoutResponseFieldsDataSchema = Schema.Struct({
  id: Schema.String,
  locked: Schema.Boolean,
  ...TryoutResponseStateSchema.fields,
  revealAnswers: Schema.optionalKey(Schema.Boolean),
});
type TryoutResponseFieldsData = typeof TryoutResponseFieldsDataSchema.Type;

type OnResponseChange = (selection: TryoutResponseSelection | null) => void;
type RenderResponseLabel = (value: TryoutResponseFieldLabel) => ReactNode;

interface TryoutResponseFieldsProps {
  onChange: OnResponseChange;
  renderLabel: RenderResponseLabel;
  value: TryoutResponseFieldsData;
}

/** Renders every response kind through one persistence-neutral surface. */
export function TryoutResponseFields({
  onChange,
  renderLabel,
  value,
}: TryoutResponseFieldsProps) {
  const t = useTranslations("Tryouts");
  const answerLabel = t("answer");
  if (value.responseSpec.kind === "single-choice") {
    return (
      <SingleChoiceFields
        answerLabel={answerLabel}
        onChange={onChange}
        renderLabel={renderLabel}
        value={value}
      />
    );
  }
  if (value.responseSpec.kind === "multiple-choice") {
    return (
      <MultipleChoiceFields
        answerLabel={answerLabel}
        onChange={onChange}
        renderLabel={renderLabel}
        value={value}
      />
    );
  }
  return (
    <CategoryFields
      onChange={onChange}
      renderLabel={renderLabel}
      value={value}
    />
  );
}

function SingleChoiceFields({
  answerLabel,
  onChange,
  renderLabel,
  value,
}: TryoutResponseFieldsProps & { answerLabel: string }) {
  const { id, locked, responseSpec, selection } = value;
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
        {responseSpec.options.map((option) => (
          <TryoutSelectableRadioOption
            appearance={previewAppearance(
              value.revealAnswers,
              option.isCorrect
            )}
            checked={selected === option.optionKey}
            disabled={locked}
            id={optionLabelId(id, option.optionKey)}
            key={option.optionKey}
            label={renderLabel({
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
  onChange,
  renderLabel,
  value,
}: TryoutResponseFieldsProps & { answerLabel: string }) {
  const { id, locked, responseSpec, selection } = value;
  if (responseSpec.kind !== "multiple-choice") {
    return null;
  }
  const selected = HashSet.fromIterable(
    selection?.kind === "multiple-choice" ? selection.optionKeys : []
  );
  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-2 border-0 p-0 md:grid-cols-2">
      <legend className="sr-only">{answerLabel}</legend>
      {responseSpec.options.map((option) => (
        <TryoutSelectableMultipleChoice
          appearance={previewAppearance(value.revealAnswers, option.isCorrect)}
          checked={HashSet.has(selected, option.optionKey)}
          disabled={locked}
          id={optionLabelId(id, option.optionKey)}
          key={option.optionKey}
          label={renderLabel({
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

function CategoryFields({
  onChange,
  renderLabel,
  value,
}: TryoutResponseFieldsProps) {
  const { id, locked, responseSpec, selection } = value;
  if (responseSpec.kind !== "category") {
    return null;
  }
  const assigned = HashMap.fromIterable(
    selection?.kind === "category"
      ? selection.assignments.map((assignment) => [
          assignment.statementKey,
          assignment.categoryKey,
        ])
      : []
  );
  return (
    <div className="space-y-6">
      {responseSpec.statements.map((statement) => {
        const statementId = statementLabelId(id, statement.statementKey);
        const statementHeadingId = `${statementId}-label`;
        const assignedCategory = Option.getOrUndefined(
          HashMap.get(assigned, statement.statementKey)
        );
        return (
          <section className="space-y-3" key={statement.statementKey}>
            <div id={statementHeadingId}>
              {renderLabel({
                id: statementId,
                label: statement.label,
              })}
            </div>
            <RadioGroup
              aria-labelledby={statementHeadingId}
              className="grid grid-cols-1 gap-2 md:grid-cols-2"
              disabled={locked}
              onValueChange={(categoryKey) =>
                onChange(
                  assignCategorySelection(
                    { responseSpec, selection },
                    statement.statementKey,
                    categoryKey
                  )
                )
              }
              value={assignedCategory ?? ""}
            >
              {responseSpec.categories.map((category) => (
                <TryoutSelectableRadioOption
                  appearance={previewAppearance(
                    value.revealAnswers,
                    statement.correctCategoryKey === undefined
                      ? undefined
                      : statement.correctCategoryKey === category.categoryKey
                  )}
                  checked={assignedCategory === category.categoryKey}
                  disabled={locked}
                  id={categoryLabelId(
                    id,
                    statement.statementKey,
                    category.categoryKey
                  )}
                  key={category.categoryKey}
                  label={renderLabel({
                    correctness: previewCorrectness(
                      value.revealAnswers,
                      statement.correctCategoryKey === undefined
                        ? undefined
                        : statement.correctCategoryKey === category.categoryKey
                    ),
                    id: categoryLabelId(
                      id,
                      statement.statementKey,
                      category.categoryKey
                    ),
                    label: category.label,
                  })}
                  value={category.categoryKey}
                />
              ))}
            </RadioGroup>
          </section>
        );
      })}
    </div>
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
