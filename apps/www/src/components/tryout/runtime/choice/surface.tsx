"use client";

import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import {
  LineMark,
  LineWords,
  MarkedLine,
} from "@repo/design-system/components/ui/line";
import { Radio } from "@repo/design-system/components/ui/radio-group";
import type { ReactNode } from "react";
import type { TryoutPreviewChoiceAppearance } from "@/lib/tryout/appearance";
import {
  getTryoutPreviewChoiceTone,
  getTryoutReviewedChoiceTone,
} from "@/lib/tryout/appearance";

interface TryoutSelectableRadioOptionProps {
  readonly appearance?: TryoutPreviewChoiceAppearance;
  checked: boolean;
  children: ReactNode;
  disabled: boolean;
  id: string;
  letter: string;
  value: string;
}

/** One radio option: its circle on the first line of its answer, in a marked line whose label holds the circle. */
export function TryoutSelectableRadioOption({
  appearance = { kind: "selectable" },
  checked,
  children,
  disabled,
  id,
  letter,
  value,
}: TryoutSelectableRadioOptionProps) {
  return (
    <ChoiceLine tone={getTryoutPreviewChoiceTone({ appearance, checked })}>
      <LineMark>
        <Radio
          aria-labelledby={`${id}-label`}
          disabled={disabled}
          letter={letter}
          value={value}
        />
      </LineMark>
      <ChoiceWords id={id} letter={letter}>
        {children}
      </ChoiceWords>
    </ChoiceLine>
  );
}

interface TryoutSelectableMultipleChoiceProps {
  readonly appearance?: TryoutPreviewChoiceAppearance;
  checked: boolean;
  children: ReactNode;
  disabled: boolean;
  id: string;
  letter: string;
  onCheckedChange: (checked: boolean) => void;
}

/** One independently selectable option for an exact-set response, its check box on its answer's first line. */
export function TryoutSelectableMultipleChoice({
  appearance = { kind: "selectable" },
  checked,
  children,
  disabled,
  id,
  letter,
  onCheckedChange,
}: TryoutSelectableMultipleChoiceProps) {
  return (
    <ChoiceLine tone={getTryoutPreviewChoiceTone({ appearance, checked })}>
      <LineMark>
        <Checkbox
          aria-labelledby={`${id}-label`}
          checked={checked}
          disabled={disabled}
          letter={letter}
          onCheckedChange={onCheckedChange}
        />
      </LineMark>
      <ChoiceWords id={id} letter={letter}>
        {children}
      </ChoiceWords>
    </ChoiceLine>
  );
}

interface TryoutReviewedChoiceProps {
  checked: boolean;
  children: ReactNode;
  id: string;
  isCorrect: boolean | undefined;
  letter: string;
}

/** One locked terminal choice without a mutation Interface. */
export function TryoutReviewedChoice({
  checked,
  children,
  id,
  isCorrect,
  letter,
}: TryoutReviewedChoiceProps) {
  return (
    <ChoiceLine tone={getTryoutReviewedChoiceTone({ checked, isCorrect })}>
      <LineMark>
        <Checkbox
          aria-labelledby={`${id}-label`}
          checked={checked}
          disabled
          letter={letter}
        />
      </LineMark>
      <ChoiceWords id={id} letter={letter}>
        {children}
      </ChoiceWords>
    </ChoiceLine>
  );
}

/**
 * The marked line of one option: a label that holds the option's circle, so a press anywhere on the line chooses it,
 * in the tone of its state.
 */
function ChoiceLine({
  children,
  tone,
}: {
  children: ReactNode;
  tone: ReturnType<typeof getTryoutPreviewChoiceTone>;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: children carries the choice control, and this label wraps it.
    <MarkedLine render={<Label />} tone={tone}>
      {children}
    </MarkedLine>
  );
}

/**
 * The answer of one option, which stands alone beside its circle. The circle's control takes its name from these
 * words, so a screen reader says the letter the circle shows, then the answer, and a key or a teacher can use it.
 */
function ChoiceWords({
  children,
  id,
  letter,
}: {
  children: ReactNode;
  id: string;
  letter: string;
}) {
  return (
    <LineWords id={`${id}-label`}>
      <span className="sr-only">{letter} </span>
      {children}
    </LineWords>
  );
}
