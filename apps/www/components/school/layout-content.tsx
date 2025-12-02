import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

export function SchoolLayoutContent({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className="size-full overflow-y-auto overflow-x-hidden py-6">
      <div
        className={cn("mx-auto w-full max-w-6xl px-6", className)}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}
