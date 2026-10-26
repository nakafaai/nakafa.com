import { fieldBoxVariants } from "@repo/design-system/lib/input";
import { cn } from "cn";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        fieldBoxVariants(),
        "selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground",
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}

export { Input };
