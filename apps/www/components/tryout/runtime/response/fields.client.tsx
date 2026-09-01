"use client";

import { Response } from "@repo/design-system/components/ai/response";
import { RadioGroup } from "@repo/design-system/components/ui/radio-group";
import { useTranslations } from "next-intl";
import {
  TryoutSelectableMultipleChoice,
  TryoutSelectableRadioOption,
} from "@/components/tryout/runtime/choice/surface.client";
import {
  assignCategorySelection,
  type TryoutResponseSelection,
  toggleMultipleChoiceSelection,
} from "@/components/tryout/runtime/response/state";
import type { TryoutRuntimeResponseSpec } from "@/components/tryout/runtime/types";

interface TryoutResponseFieldsValue {
  readonly id: string;
  readonly locked: boolean;
  readonly onChange: (selection: TryoutResponseSelection | null) => void;
  readonly responseSpec: TryoutRuntimeResponseSpec;
  readonly selection: TryoutResponseSelection | null;
}

/** Renders every response kind through one persistence-neutral surface. */
export function TryoutResponseFields({
  value,
}: {
  value: TryoutResponseFieldsValue;
}) {
  const t = useTranslations("Exercises");
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
  value: TryoutResponseFieldsValue;
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
        {responseSpec.options.map((option) => (
          <TryoutSelectableRadioOption
            checked={selected === option.optionKey}
            disabled={locked}
            id={`${id}-${option.optionKey}`}
            key={option.optionKey}
            label={
              <ResponseLabel id={`${id}-${option.optionKey}`}>
                {option.label}
              </ResponseLabel>
            }
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
  value: TryoutResponseFieldsValue;
}) {
  const { id, locked, onChange, responseSpec, selection } = value;
  if (responseSpec.kind !== "multiple-choice") {
    return null;
  }
  const selected = new Set(
    selection?.kind === "multiple-choice" ? selection.optionKeys : []
  );
  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-2 border-0 p-0 md:grid-cols-2">
      <legend className="sr-only">{answerLabel}</legend>
      {responseSpec.options.map((option) => (
        <TryoutSelectableMultipleChoice
          checked={selected.has(option.optionKey)}
          disabled={locked}
          id={`${id}-${option.optionKey}`}
          key={option.optionKey}
          label={
            <ResponseLabel id={`${id}-${option.optionKey}`}>
              {option.label}
            </ResponseLabel>
          }
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

function CategoryFields({ value }: { value: TryoutResponseFieldsValue }) {
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
        const statementLabelId = `${id}-${statement.statementKey}-label`;
        return (
          <section className="space-y-3" key={statement.statementKey}>
            <div id={statementLabelId}>
              <ResponseLabel id={`${id}-${statement.statementKey}`}>
                {statement.label}
              </ResponseLabel>
            </div>
            <RadioGroup
              aria-labelledby={statementLabelId}
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
                  checked={
                    assigned.get(statement.statementKey) ===
                    category.categoryKey
                  }
                  disabled={locked}
                  id={`${id}-${statement.statementKey}-${category.categoryKey}`}
                  key={category.categoryKey}
                  label={
                    <ResponseLabel
                      id={`${id}-${statement.statementKey}-${category.categoryKey}`}
                    >
                      {category.label}
                    </ResponseLabel>
                  }
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

/** Renders mixed prose and math without an authored text or math discriminator. */
function ResponseLabel({ children, id }: { children: string; id: string }) {
  return (
    <Response
      className="wrap-anywhere h-auto whitespace-normal"
      id={`${id}-label-content`}
    >
      {children}
    </Response>
  );
}
