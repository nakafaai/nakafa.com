import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

export function SchoolLayoutContent({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-3xl space-y-4 p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
