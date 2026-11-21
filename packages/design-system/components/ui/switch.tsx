import { Switch as SwitchPrimitive, SwitchThumb } from "@ui-sdk/react/switch";
import { cn } from "cn";
import type * as React from "react";

/**
 * A setting that takes effect the moment it is turned on or off, with its label beside it.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive>) {
  return (
    <SwitchPrimitive
      className={cn(
        "pressable peer focus-visible:border-ring focus-visible:ring-ring/50 data-checked:bg-primary data-unchecked:bg-input inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-[scale,background-color,border-color,box-shadow] outline-none focus-visible:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchThumb
        className={cn(
          "bg-background dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0"
        )}
      />
    </SwitchPrimitive>
  );
}

export { Switch };
