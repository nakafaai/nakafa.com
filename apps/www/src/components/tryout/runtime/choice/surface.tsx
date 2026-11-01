"use client";

import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import { Radio } from "@repo/design-system/components/ui/radio-group";
import type { buttonVariants } from "@repo/design-system/lib/button";
import type { ReactNode } from "react";
import { choiceFrame } from "@/components/tryout/runtime/choice/frame";
import type { TryoutPreviewChoiceAppearance } from "@/lib/tryout/appearance";
import {
  getTryoutPreviewChoiceVariant,
  getTryoutReviewedChoiceVariant,
} from "@/lib/tryout/appearance";

interface TryoutSelectableRadioOptionProps {
  readonly appearance?: TryoutPreviewChoiceAppearance;
  checked: boolean;
  disabled: boolean;
  id: string;
  label: ReactNode;
  /** The letter that names the option in its set (`optionLetters`). */
  letter: string;
  value: string;
}

/** Renders one radio option through the established choice frame. */
export function TryoutSelectableRadioOption({
  appearance = { kind: "selectable" },
  checked,
  disabled,
  id,
  label,
  letter,
  value,
}: TryoutSelectableRadioOptionProps) {
  return (
    <TryoutChoiceFrame
      variant={getTryoutPreviewChoiceVariant({ appearance, checked })}
    >
      <Radio
        aria-labelledby={`${id}-label`}
        className="mt-1 shrink-0"
        disabled={disabled}
        value={value}
      />
      <LetteredChoice id={`${id}-label`} letter={letter}>
        {label}
      </LetteredChoice>
    </TryoutChoiceFrame>
  );
}

interface TryoutSelectableMultipleChoiceProps {
  readonly appearance?: TryoutPreviewChoiceAppearance;
  checked: boolean;
  disabled: boolean;
  id: string;
  label: ReactNode;
  /** The letter that names the option in its set (`optionLetters`). */
  letter: string;
  onCheckedChange: (checked: boolean) => void;
}

/** Renders one independently selectable option for an exact-set response. */
export function TryoutSelectableMultipleChoice({
  appearance = { kind: "selectable" },
  checked,
  disabled,
  id,
  label,
  letter,
  onCheckedChange,
}: TryoutSelectableMultipleChoiceProps) {
  return (
    <TryoutChoiceFrame
      variant={getTryoutPreviewChoiceVariant({ appearance, checked })}
    >
      <Checkbox
        aria-labelledby={`${id}-label`}
        checked={checked}
        className="mt-1 shrink-0"
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <LetteredChoice id={`${id}-label`} letter={letter}>
        {label}
      </LetteredChoice>
    </TryoutChoiceFrame>
  );
}

interface TryoutReviewedChoiceProps {
  checked: boolean;
  id: string;
  isCorrect: boolean | undefined;
  label: ReactNode;
  /** The letter that names the option in its set (`optionLetters`). */
  letter: string;
}

/** Renders one locked terminal choice without a mutation Interface. */
export function TryoutReviewedChoice({
  checked,
  id,
  isCorrect,
  label,
  letter,
}: TryoutReviewedChoiceProps) {
  return (
    <TryoutChoiceFrame
      variant={getTryoutReviewedChoiceVariant({ checked, isCorrect })}
    >
      <Checkbox
        aria-labelledby={`${id}-label`}
        checked={checked}
        className="mt-1 shrink-0"
        disabled
      />
      <LetteredChoice id={`${id}-label`} letter={letter}>
        {label}
      </LetteredChoice>
    </TryoutChoiceFrame>
  );
}

type ButtonVariantOptions = NonNullable<Parameters<typeof buttonVariants>[0]>;

/** Owns the shared visual composition for every explicit choice variant: its control, then its label. */
function TryoutChoiceFrame({
  children,
  variant,
}: {
  children: ReactNode;
  variant: NonNullable<ButtonVariantOptions["variant"]>;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: children carries the choice control, and this label wraps it.
    <Label className={choiceFrame(variant)}>{children}</Label>
  );
}

/**
 * The letter and the text of one option, the one way every surface draws them: the player, the review,
 * a sitting and the exam editor's paper. The control names the option by this block's id, so a screen
 * reader says the letter a key or a teacher uses. Its direction follows the letter, which the option set
 * chose from its labels, so an Arabic set reads right to left with أ at its start in an Indonesian
 * question, and any other set keeps reading left to right. The letter is part of the first paint, so
 * nothing moves when the text arrives with it.
 */
export function LetteredChoice({
  children,
  id,
  letter,
}: {
  children: ReactNode;
  /** The id that the control is labelled by, when the option has a control to name. */
  id?: string;
  letter: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 gap-2" dir="auto" id={id}>
      <span className="shrink-0 font-medium">{letter}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
