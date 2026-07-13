"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer size-4 shrink-0 rounded-lg border border-input bg-input/70 shadow-xs outline-none transition-shadow focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive data-disabled:cursor-not-allowed data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-disabled:opacity-50 dark:bg-input/30 dark:data-checked:bg-primary",
        className
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="grid place-content-center text-current transition-none"
        data-slot="checkbox-indicator"
      >
        <HugeIcons className="size-3.5" icon={Tick01Icon} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
