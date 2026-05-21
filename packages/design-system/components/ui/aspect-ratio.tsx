import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";

function AspectRatio({
  className,
  ratio,
  style,
  ...props
}: React.ComponentProps<"div"> & { ratio: number }) {
  return (
    <div
      className={cn("relative aspect-(--ratio)", className)}
      data-slot="aspect-ratio"
      {...props}
      style={{ "--ratio": ratio, ...style } as React.CSSProperties}
    />
  );
}

export { AspectRatio };
