import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { letterBubble } from "@repo/design-system/lib/bubble";
import {
  CheckboxIndicator,
  Checkbox as CheckboxPrimitive,
} from "@ui-sdk/react/checkbox";
import { cn } from "cn";
import type * as React from "react";

/**
 * A choice that is on or off, or one of several in a group. Its label sits beside it and toggles it too. It is never
 * half on: a choice of Nakafa is made or not.
 */
function Checkbox({
  className,
  letter,
  onCheckedChange,
  ...props
}: Omit<
  React.ComponentProps<typeof CheckboxPrimitive>,
  "checked" | "defaultChecked" | "onCheckedChange"
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  /** The letter the circle holds in place of its tick, as an answer sheet draws its options. */
  readonly letter?: string;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <CheckboxPrimitive
      className={cn(
        "pressable peer border-muted-foreground bg-input/70 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:bg-input/30 dark:data-checked:bg-primary dark:aria-invalid:ring-destructive/40 size-4 shrink-0 rounded-[4px] border shadow-xs transition-[scale,box-shadow] outline-none focus-visible:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        letter === undefined ? undefined : letterBubble(),
        className
      )}
      onCheckedChange={(next) => onCheckedChange?.(next === true)}
      {...props}
    >
      {letter ?? (
        <CheckboxIndicator className="grid place-content-center text-current transition-none">
          <HugeIcons icon={Tick01Icon} size="sm" />
        </CheckboxIndicator>
      )}
    </CheckboxPrimitive>
  );
}

export { Checkbox };
