"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@repo/design-system/lib/utils";

function Progress({
  className,
  children,
  value,
  ...props
}: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      data-slot="progress"
      value={value}
      {...props}
    >
      {children}
      <ProgressPrimitive.Track className="h-full w-full">
        <ProgressPrimitive.Indicator
          className="h-full bg-primary transition-all"
          data-slot="progress-indicator"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
