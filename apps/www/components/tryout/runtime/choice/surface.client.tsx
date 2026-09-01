"use client";

import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import { Radio } from "@repo/design-system/components/ui/radio-group";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";
import type { TryoutPreviewChoiceAppearance } from "@/lib/tryout/choice-variant";
import {
  getTryoutPreviewChoiceVariant,
  getTryoutReviewedChoiceVariant,
  getTryoutSelectableChoiceVariant,
} from "@/lib/tryout/choice-variant";

interface TryoutSelectableChoiceProps {
  checked: boolean;
  disabled: boolean;
  id: string;
  label: ReactNode;
  onSelect: () => void;
}

/** Renders one selectable choice without revealing answer correctness. */
export function TryoutSelectableChoice({
  checked,
  disabled,
  id,
  label,
  onSelect,
}: TryoutSelectableChoiceProps) {
  return (
    <TryoutChoiceFrame
      id={id}
      label={label}
      variant={getTryoutSelectableChoiceVariant({ checked })}
    >
      <TryoutChoiceCheckbox
        checked={checked}
        disabled={disabled}
        id={id}
        onSelect={onSelect}
      />
    </TryoutChoiceFrame>
  );
}

interface TryoutSelectableRadioOptionProps {
  checked: boolean;
  disabled: boolean;
  id: string;
  label: ReactNode;
  value: string;
}

/** Renders one radio option through the established choice frame. */
export function TryoutSelectableRadioOption({
  checked,
  disabled,
  id,
  label,
  value,
}: TryoutSelectableRadioOptionProps) {
  return (
    <TryoutChoiceFrame
      id={id}
      label={label}
      variant={getTryoutSelectableChoiceVariant({ checked })}
    >
      <Radio
        aria-labelledby={`${id}-label`}
        className="mt-1 shrink-0 cursor-pointer"
        disabled={disabled}
        value={value}
      />
    </TryoutChoiceFrame>
  );
}

interface TryoutSelectableMultipleChoiceProps {
  checked: boolean;
  disabled: boolean;
  id: string;
  label: ReactNode;
  onCheckedChange: (checked: boolean) => void;
}

/** Renders one independently selectable option for an exact-set response. */
export function TryoutSelectableMultipleChoice({
  checked,
  disabled,
  id,
  label,
  onCheckedChange,
}: TryoutSelectableMultipleChoiceProps) {
  return (
    <TryoutChoiceFrame
      id={id}
      label={label}
      variant={getTryoutSelectableChoiceVariant({ checked })}
    >
      <Checkbox
        aria-labelledby={`${id}-label`}
        checked={checked}
        className="mt-1 shrink-0 cursor-pointer"
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </TryoutChoiceFrame>
  );
}

interface TryoutPreviewChoiceProps extends TryoutSelectableChoiceProps {
  appearance: TryoutPreviewChoiceAppearance;
}

/** Keeps one stable preview choice while its correctness appearance changes. */
export function TryoutPreviewChoice({
  appearance,
  checked,
  disabled,
  id,
  label,
  onSelect,
}: TryoutPreviewChoiceProps) {
  return (
    <TryoutChoiceFrame
      id={id}
      label={label}
      variant={getTryoutPreviewChoiceVariant({
        appearance,
        checked,
      })}
    >
      <TryoutChoiceCheckbox
        checked={checked}
        disabled={disabled}
        id={id}
        onSelect={onSelect}
      />
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
      id={id}
      label={label}
      variant={getTryoutReviewedChoiceVariant({ checked, isCorrect })}
    >
      <Checkbox
        aria-labelledby={`${id}-label`}
        checked={checked}
        className="mt-1 shrink-0 cursor-pointer"
        disabled
      />
    </TryoutChoiceFrame>
  );
}

interface TryoutChoiceCheckboxProps {
  checked: boolean;
  disabled: boolean;
  id: string;
  onSelect: () => void;
}

/** Owns the checkbox interaction shared by active and preview choices. */
function TryoutChoiceCheckbox({
  checked,
  disabled,
  id,
  onSelect,
}: TryoutChoiceCheckboxProps) {
  return (
    <Checkbox
      aria-labelledby={`${id}-label`}
      checked={checked}
      className="mt-1 shrink-0 cursor-pointer"
      disabled={disabled}
      onCheckedChange={(nextChecked) => {
        if (nextChecked) {
          onSelect();
        }
      }}
    />
  );
}

type ButtonVariantOptions = NonNullable<Parameters<typeof buttonVariants>[0]>;

interface TryoutChoiceFrameProps {
  children: ReactNode;
  id: string;
  label: ReactNode;
  variant: NonNullable<ButtonVariantOptions["variant"]>;
}

/** Owns the shared visual composition for every explicit choice variant. */
function TryoutChoiceFrame({
  children,
  id,
  label,
  variant,
}: TryoutChoiceFrameProps) {
  const labelId = `${id}-label`;

  return (
    <Label
      className={cn(
        buttonVariants({ variant }),
        "h-auto min-w-0 whitespace-normal text-left font-normal text-base"
      )}
    >
      {children}
      <div className="min-w-0 flex-1" id={labelId}>
        {label}
      </div>
    </Label>
  );
}
