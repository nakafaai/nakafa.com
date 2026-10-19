"use client";

import { RadioGroup } from "@repo/design-system/components/ui/radio-group";
import { Array as Arr, Option } from "effect";
import { useId } from "react";
import { SittingDocument } from "@/components/exams/sitting/document";
import { type Choice, toggleOption } from "@/components/exams/sitting/response";
import {
  TryoutSelectableMultipleChoice,
  TryoutSelectableRadioOption,
} from "@/components/tryout/runtime/choice/surface.client";

/**
 * The options of one choice, read from the paper. A single choice is a radio group, and a
 * multiple choice takes checks up to its maximum. Each change calls `onChoose` with the response
 * that the change makes, so the caller saves it at once.
 */
export function SittingChoice({
  choice,
  labelledBy,
  onChoose,
  response,
}: {
  readonly choice: Choice;
  /** The id of the heading that names the choice. */
  readonly labelledBy: string;
  readonly onChoose: (response: readonly string[]) => void;
  readonly response: readonly string[];
}) {
  const id = useId();

  if (choice.maxChoices === 1) {
    return (
      <RadioGroup
        aria-labelledby={labelledBy}
        className="grid grid-cols-1 gap-2 md:grid-cols-2"
        onValueChange={(optionId) => onChoose([optionId])}
        value={Option.getOrElse(Arr.head(response), () => "")}
      >
        {Arr.map(choice.options, (option) => (
          <TryoutSelectableRadioOption
            checked={Arr.contains(response, option.id)}
            disabled={false}
            id={`${id}-${option.id}`}
            key={option.id}
            label={
              <SittingDocument
                document={option.label}
                label={choice.label}
                size="line"
              />
            }
            value={option.id}
          />
        ))}
      </RadioGroup>
    );
  }

  return (
    <fieldset
      aria-labelledby={labelledBy}
      className="grid min-w-0 grid-cols-1 gap-2 border-0 p-0 md:grid-cols-2"
    >
      {Arr.map(choice.options, (option) => (
        <TryoutSelectableMultipleChoice
          checked={Arr.contains(response, option.id)}
          disabled={false}
          id={`${id}-${option.id}`}
          key={option.id}
          label={
            <SittingDocument
              document={option.label}
              label={choice.label}
              size="line"
            />
          }
          onCheckedChange={(checked) =>
            onChoose(
              toggleOption(response, option.id, checked, choice.maxChoices)
            )
          }
        />
      ))}
    </fieldset>
  );
}
