import { letterBubble } from "@repo/design-system/lib/bubble";
import {
  RadioGroup as RadioGroupPrimitive,
  RadioIndicator,
  Radio as RadioPrimitive,
} from "@ui-sdk/react/radio";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type * as React from "react";

/**
 * One choice among a few options that all stay visible. For more than a handful use a `Select` or a `Picker`.
 */
function RadioGroup({
  className,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof RadioGroupPrimitive>, "onValueChange"> & {
  /** Runs with the value the reader chose. A group of Nakafa never empties once a value is chosen. */
  onValueChange?: (value: string) => void;
}) {
  return (
    <RadioGroupPrimitive
      className={cn("flex flex-col gap-3", className)}
      onValueChange={(value) => {
        if (value !== null) {
          onValueChange?.(value);
        }
      }}
      {...props}
    />
  );
}

/** The circle of a radio, in every state it shows. */
const radioCircleVariants = cva(
  "pressable border-muted-foreground bg-background focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive focus-visible:aria-invalid:border-destructive focus-visible:aria-invalid:ring-destructive/48 dark:not-data-checked:bg-input/32 relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border bg-clip-padding shadow-xs transition-[scale,box-shadow] outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-full not-disabled:not-data-checked:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-64 dark:bg-clip-border dark:not-disabled:not-data-checked:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/8%)] [:disabled,[data-checked],[aria-invalid]]:shadow-none"
);

function Radio({
  className,
  letter,
  ...props
}: React.ComponentProps<typeof RadioPrimitive> & {
  /** The letter the circle holds in place of its dot, as an answer sheet draws its options. */
  readonly letter?: string;
}) {
  return (
    <RadioPrimitive
      className={cn(
        radioCircleVariants(),
        letter === undefined ? undefined : letterBubble(),
        className
      )}
      {...props}
    >
      {letter ?? (
        <RadioIndicator className="before:bg-primary-foreground data-checked:bg-primary absolute -inset-px flex size-4 items-center justify-center rounded-full before:size-1.5 before:rounded-full data-unchecked:hidden" />
      )}
    </RadioPrimitive>
  );
}

/**
 * A radio's circle with its letter, drawn as a picture and never pressed: a paper that shows a student's options out
 * of reach, as the exam editor does, draws the circle the student will meet without a group to choose in.
 */
function RadioMark({
  className,
  letter,
}: {
  className?: string | undefined;
  /** The letter the circle holds, as an answer sheet draws its options. */
  readonly letter: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(radioCircleVariants(), letterBubble(), className)}
      data-slot="radio-mark"
    >
      {letter}
    </span>
  );
}

export { Radio, RadioGroup, RadioMark };
