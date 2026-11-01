import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { letterBubble } from "@repo/design-system/lib/bubble";
import { cn } from "cn";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      className={cn("flex flex-col gap-3", className)}
      data-slot="radio-group"
      {...props}
    />
  );
}

function Radio({
  className,
  letter,
  ...props
}: RadioPrimitive.Root.Props & {
  /** The letter the circle holds in place of its dot, as an answer sheet draws its options. */
  readonly letter?: string;
}) {
  return (
    <RadioPrimitive.Root
      className={cn(
        "pressable border-input bg-background focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive focus-visible:aria-invalid:border-destructive focus-visible:aria-invalid:ring-destructive/48 dark:not-data-checked:bg-input/32 relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border bg-clip-padding shadow-xs transition-[scale,box-shadow] outline-none before:pointer-events-none before:absolute before:inset-0 before:rounded-full not-disabled:not-data-checked:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-64 dark:bg-clip-border dark:not-disabled:not-data-checked:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/8%)] [:disabled,[data-checked],[aria-invalid]]:shadow-none",
        letter === undefined ? undefined : letterBubble(),
        className
      )}
      data-slot="radio"
      {...props}
    >
      {letter ?? (
        <RadioPrimitive.Indicator
          className="before:bg-primary-foreground data-checked:bg-primary absolute -inset-px flex size-4 items-center justify-center rounded-full before:size-1.5 before:rounded-full data-unchecked:hidden"
          data-slot="radio-indicator"
        />
      )}
    </RadioPrimitive.Root>
  );
}

export { Radio, Radio as RadioGroupItem, RadioGroup };
