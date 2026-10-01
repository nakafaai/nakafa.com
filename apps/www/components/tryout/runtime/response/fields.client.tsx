"use client";

import { RadioGroup } from "@repo/design-system/components/ui/radio-group";
import { useTranslations } from "next-intl";
import type { PlayerResponseValue } from "@/components/player/response";
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
  toggleMultipleChoiceSelection,
} from "@/components/tryout/runtime/response/state";

/** Renders one single-choice response as a radio group. */
export function SingleChoiceFields({
  value,
}: {
  readonly value: PlayerResponseValue;
}) {
  const t = useTranslations("Exercises");
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
        {t("answer")}
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

/** Renders one multiple-choice response as checkboxes. */
export function MultipleChoiceFields({
  value,
}: {
  readonly value: PlayerResponseValue;
}) {
  const t = useTranslations("Exercises");
  const { id, locked, onChange, responseSpec, selection } = value;
  if (responseSpec.kind !== "multiple-choice") {
    return null;
  }
  const selected = new Set(
    selection?.kind === "multiple-choice" ? selection.optionKeys : []
  );
  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-2 border-0 p-0 md:grid-cols-2">
      <legend className="sr-only">{t("answer")}</legend>
      {responseSpec.options.map((option) => (
        <TryoutSelectableMultipleChoice
          appearance={previewAppearance(value.revealAnswers, option.isCorrect)}
          checked={selected.has(option.optionKey)}
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

/** Renders one category response as a radio group per statement. */
export function CategoryFields({
  value,
}: {
  readonly value: PlayerResponseValue;
}) {
  const { id, locked, onChange, responseSpec, selection } = value;
  if (responseSpec.kind !== "category") {
    return null;
  }
  const assigned = new Map(
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
        return (
          <section className="space-y-3" key={statement.statementKey}>
            <div id={statementHeadingId}>
              {value.renderLabel({
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
              value={assigned.get(statement.statementKey) ?? ""}
            >
              {responseSpec.categories.map((category) => (
                <TryoutSelectableRadioOption
                  appearance={previewAppearance(
                    value.revealAnswers,
                    statement.correctCategoryKey === undefined
                      ? undefined
                      : statement.correctCategoryKey === category.categoryKey
                  )}
                  checked={
                    assigned.get(statement.statementKey) ===
                    category.categoryKey
                  }
                  disabled={locked}
                  id={categoryLabelId(
                    id,
                    statement.statementKey,
                    category.categoryKey
                  )}
                  key={category.categoryKey}
                  label={value.renderLabel({
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
