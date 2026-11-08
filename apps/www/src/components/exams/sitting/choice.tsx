import { partDirection, partLetter } from "@repo/backend/confect/exams/letters";
import { RadioGroup } from "@repo/design-system/components/ui/radio-group";
import { Array as Arr, Option } from "effect";
import { useId } from "react";
import { SittingDocument } from "@/components/exams/sitting/document";
import { usePaperLocked } from "@/components/exams/sitting/lock";
import { ChoiceCheck, ChoiceRadio } from "@/components/player/choice";
import { type Choice, toggleOption } from "@/components/player/response";

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
  const disabled = usePaperLocked();
  const id = useId();
  const direction = partDirection(choice.options);

  if (choice.maxChoices === 1) {
    return (
      <RadioGroup
        aria-labelledby={labelledBy}
        className="grid grid-cols-1 gap-2 md:grid-cols-2"
        dir={direction}
        onValueChange={(optionId) => onChoose([optionId])}
        value={Option.getOrElse(Arr.head(response), () => "")}
      >
        {Arr.map(choice.options, (option, index) => (
          <ChoiceRadio
            checked={Arr.contains(response, option.id)}
            disabled={disabled}
            id={`${id}-${option.id}`}
            key={option.id}
            letter={partLetter(choice.options, index)}
            value={option.id}
          >
            <SittingDocument document={option.label} size="line" />
          </ChoiceRadio>
        ))}
      </RadioGroup>
    );
  }

  return (
    <fieldset
      aria-labelledby={labelledBy}
      className="grid min-w-0 grid-cols-1 gap-2 border-0 p-0 md:grid-cols-2"
      dir={direction}
    >
      {Arr.map(choice.options, (option, index) => (
        <ChoiceCheck
          checked={Arr.contains(response, option.id)}
          disabled={disabled}
          id={`${id}-${option.id}`}
          key={option.id}
          letter={partLetter(choice.options, index)}
          onCheckedChange={(checked) =>
            onChoose(
              toggleOption(response, option.id, checked, choice.maxChoices)
            )
          }
        >
          <SittingDocument document={option.label} size="line" />
        </ChoiceCheck>
      ))}
    </fieldset>
  );
}
