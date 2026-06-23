import { cn } from "@repo/design-system/lib/utils";
import type { ElementType, ReactNode } from "react";

/**
 * Renders constrained readable page content with a caller-selected semantic tag.
 */
export function LayoutContent({
  children,
  className,
  as: Component = "article",
}: {
  as?: ElementType<{ children?: ReactNode; className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Component className={cn("mx-auto max-w-3xl px-6", className)}>
      {children}
    </Component>
  );
}
