import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

/** Shared sticky header surface; each route owns its heading and actions. */
export function BreadcrumbHeaderFrame({
  children,
  contentClassName,
}: {
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <header className="sticky top-16 z-10 flex min-h-16 w-full shrink-0 border-b bg-background lg:top-0">
      <div
        className={cn(
          "mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-6 py-3",
          contentClassName
        )}
      >
        {children}
      </div>
    </header>
  );
}
