"use client";

import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import { Response } from "@repo/design-system/components/ai/response";
import { RadioGroup } from "@repo/design-system/components/ui/radio-group";
import {
  TryoutSelectableChoice,
  TryoutSelectableMultipleChoice,
  TryoutSelectableRadioOption,
} from "@/components/tryout/runtime/choice/surface.client";
import {
  assignCategorySelection,
  type TryoutResponseSelection,
  toggleMultipleChoiceSelection,
} from "@/components/tryout/runtime/response/state";
import type { TryoutRuntimeResponseSpec } from "@/components/tryout/runtime/types";

type RenderableResponseSpec = QuestionResponse | TryoutRuntimeResponseSpec;

interface TryoutResponseFieldsValue {
  readonly id: string;
  readonly locked: boolean;
  readonly onChange: (selection: TryoutResponseSelection | null) => void;
  readonly responseSpec: RenderableResponseSpec;
  readonly selection: TryoutResponseSelection | null;
}

/** Renders every response kind through one persistence-neutral surface. */
export function TryoutResponseFields({
  value,
}: {
  value: TryoutResponseFieldsValue;
}) {
  if (value.responseSpec.kind === "single-choice") {
    return <SingleChoiceFields value={value} />;
  }
  if (value.responseSpec.kind === "multiple-choice") {
    return <MultipleChoiceFields value={value} />;
  }
  return <CategoryFields value={value} />;
}

function SingleChoiceFields({ value }: { value: TryoutResponseFieldsValue }) {
  const { id, locked, onChange, responseSpec, selection } = value;
  if (responseSpec.kind !== "single-choice") {
    return null;
  }
  const selected =
    selection?.kind === "single-choice" ? selection.optionKey : "";
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {responseSpec.options.map((option) => (
        <TryoutSelectableChoice
          checked={selected === option.optionKey}
          disabled={locked}
          id={`${id}-${option.optionKey}`}
          key={option.optionKey}
          label={
            <ResponseLabel id={`${id}-${option.optionKey}`}>
              {option.label}
            </ResponseLabel>
          }
          onSelect={() =>
            onChange({ kind: "single-choice", optionKey: option.optionKey })
          }
        />
      ))}
    </div>
  );
}

function MultipleChoiceFields({ value }: { value: TryoutResponseFieldsValue }) {
  const { id, locked, onChange, responseSpec, selection } = value;
  if (responseSpec.kind !== "multiple-choice") {
    return null;
  }
  const selected = new Set(
    selection?.kind === "multiple-choice" ? selection.optionKeys : []
  );
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
    </div>
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
      {responseSpec.statements.map((statement) => (
        <section className="space-y-3" key={statement.statementKey}>
          <ResponseLabel id={`${id}-${statement.statementKey}`}>
            {statement.label}
          </ResponseLabel>
          <RadioGroup
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
                  assigned.get(statement.statementKey) === category.categoryKey
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
      ))}
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
