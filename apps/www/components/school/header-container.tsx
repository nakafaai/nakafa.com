import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

export function HeaderContainer({
  children,
  className,
  ...props
}: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-16 w-full shrink-0 border-b bg-background",
        className
      )}
      {...props}
    >
      <div className="mx-auto flex w-full max-w-3xl gap-3 px-6">{children}</div>
    </header>
  );
}
