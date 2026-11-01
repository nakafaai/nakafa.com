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
  children: ReactNode;
  disabled: boolean;
  id: string;
  letter: string;
  value: string;
}

/** Renders one radio option through the established choice frame. */
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
    <TryoutChoiceFrame
      variant={getTryoutPreviewChoiceVariant({ appearance, checked })}
    >
      <Radio
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        letter={letter}
        value={value}
      />
      <ChoiceAnswer id={id} letter={letter}>
        {children}
      </ChoiceAnswer>
    </TryoutChoiceFrame>
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

/** Renders one independently selectable option for an exact-set response. */
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
    <TryoutChoiceFrame
      variant={getTryoutPreviewChoiceVariant({ appearance, checked })}
    >
      <Checkbox
        aria-labelledby={`${id}-label`}
        checked={checked}
        disabled={disabled}
        letter={letter}
        onCheckedChange={onCheckedChange}
      />
      <ChoiceAnswer id={id} letter={letter}>
        {children}
      </ChoiceAnswer>
    </TryoutChoiceFrame>
  );
}

interface TryoutReviewedChoiceProps {
  checked: boolean;
  children: ReactNode;
  id: string;
  isCorrect: boolean | undefined;
  letter: string;
}

/** Renders one locked terminal choice without a mutation Interface. */
export function TryoutReviewedChoice({
  checked,
  children,
  id,
  isCorrect,
  letter,
}: TryoutReviewedChoiceProps) {
  return (
    <TryoutChoiceFrame
      variant={getTryoutReviewedChoiceVariant({ checked, isCorrect })}
    >
      <Checkbox
        aria-labelledby={`${id}-label`}
        checked={checked}
        disabled
        letter={letter}
      />
      <ChoiceAnswer id={id} letter={letter}>
        {children}
      </ChoiceAnswer>
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
 * The answer of one option, which stands alone beside its circle. The circle's control takes its name from this
 * block, so a screen reader says the letter the circle shows, then the answer, and a key or a teacher can use it.
 */
function ChoiceAnswer({
  children,
  id,
  letter,
}: {
  children: ReactNode;
  id: string;
  letter: string;
}) {
  return (
    <div className="min-w-0 flex-1" id={`${id}-label`}>
      <span className="sr-only">{letter} </span>
      {children}
    </div>
  );
}
