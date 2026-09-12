import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import type { ComponentProps } from "react";

export function HugeIcons({
  className,
  strokeWidth = 2,
  ...props
}: ComponentProps<typeof HugeiconsIcon>) {
  return (
    <HugeiconsIcon
      className={cn("shrink-0", className)}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}
