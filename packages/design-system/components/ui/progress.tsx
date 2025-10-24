"use client";

import { cn } from "@repo/design-system/lib/utils";
import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";

const PROGRESS_INDICATOR_TRANSLATE_X_PERCENTAGE = 100;

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className,
      )}
      data-slot="progress"
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all"
        data-slot="progress-indicator"
        style={{
          transform: `translateX(-${
            PROGRESS_INDICATOR_TRANSLATE_X_PERCENTAGE - (value || 0)
          }%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
