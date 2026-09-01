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
} from "@/lib/tryout/choice-variant";

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
      id={id}
      label={label}
      variant={getTryoutPreviewChoiceVariant({ appearance, checked })}
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
      id={id}
      label={label}
      variant={getTryoutPreviewChoiceVariant({ appearance, checked })}
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
