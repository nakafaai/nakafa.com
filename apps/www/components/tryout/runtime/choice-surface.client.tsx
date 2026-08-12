"use client";

import { Response } from "@repo/design-system/components/ai/response";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";
import {
  getTryoutReviewedChoiceVariant,
  getTryoutSelectableChoiceVariant,
} from "@/lib/tryout/choice-variant";

interface TryoutSelectableChoiceProps {
  checked: boolean;
  disabled: boolean;
  id: string;
  label: string;
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

interface TryoutRevealedChoiceProps extends TryoutSelectableChoiceProps {
  isCorrect: boolean | undefined;
}

/** Renders one selectable preview choice with correctness revealed. */
export function TryoutRevealedChoice({
  checked,
  disabled,
  id,
  isCorrect,
  label,
  onSelect,
}: TryoutRevealedChoiceProps) {
  return (
    <TryoutChoiceFrame
      id={id}
      label={label}
      variant={getTryoutReviewedChoiceVariant({ checked, isCorrect })}
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
  label: string;
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
  label: string;
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
        <Response className="wrap-anywhere h-auto whitespace-normal" id={id}>
          {label}
        </Response>
      </div>
    </Label>
  );
}
