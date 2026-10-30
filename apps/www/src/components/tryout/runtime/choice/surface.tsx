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
  value: string;
}

/** Renders one radio option through the established choice frame. */
export function TryoutSelectableRadioOption({
  appearance = { kind: "selectable" },
  checked,
  disabled,
  id,
  label,
  value,
}: TryoutSelectableRadioOptionProps) {
  return (
    <TryoutChoiceFrame
      variant={getTryoutPreviewChoiceVariant({ appearance, checked })}
    >
      <Radio
        aria-labelledby={`${id}-label`}
        className="mt-1 shrink-0 cursor-pointer"
        disabled={disabled}
        value={value}
      />
      <TryoutChoiceLabel id={id}>{label}</TryoutChoiceLabel>
    </TryoutChoiceFrame>
  );
}

interface TryoutSelectableMultipleChoiceProps {
  readonly appearance?: TryoutPreviewChoiceAppearance;
  checked: boolean;
  disabled: boolean;
  id: string;
  label: ReactNode;
  onCheckedChange: (checked: boolean) => void;
}

/** Renders one independently selectable option for an exact-set response. */
export function TryoutSelectableMultipleChoice({
  appearance = { kind: "selectable" },
  checked,
  disabled,
  id,
  label,
  onCheckedChange,
}: TryoutSelectableMultipleChoiceProps) {
  return (
    <TryoutChoiceFrame
      variant={getTryoutPreviewChoiceVariant({ appearance, checked })}
    >
      <Checkbox
        aria-labelledby={`${id}-label`}
        checked={checked}
        className="mt-1 shrink-0 cursor-pointer"
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <TryoutChoiceLabel id={id}>{label}</TryoutChoiceLabel>
    </TryoutChoiceFrame>
  );
}

interface TryoutReviewedChoiceProps {
  checked: boolean;
  id: string;
  isCorrect: boolean | undefined;
  label: ReactNode;
}

/** Renders one locked terminal choice without a mutation Interface. */
export function TryoutReviewedChoice({
  checked,
  id,
  isCorrect,
  label,
}: TryoutReviewedChoiceProps) {
  return (
    <TryoutChoiceFrame
      variant={getTryoutReviewedChoiceVariant({ checked, isCorrect })}
    >
      <Checkbox
        aria-labelledby={`${id}-label`}
        checked={checked}
        className="mt-1 shrink-0 cursor-pointer"
        disabled
      />
      <TryoutChoiceLabel id={id}>{label}</TryoutChoiceLabel>
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
 * The label of one choice, which its control names by id. Its direction
 * follows its own text, so a choice written in Arabic reads right to left in
 * an Indonesian question, and a Latin one keeps reading left to right.
 */
function TryoutChoiceLabel({
  children,
  id,
}: {
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="min-w-0 flex-1" dir="auto" id={`${id}-label`}>
      {children}
    </div>
  );
}
