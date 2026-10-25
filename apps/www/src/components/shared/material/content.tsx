import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * Renders the main material column.
 *
 * `min-w-0` lets the flex item shrink below its content's min-content width,
 * while BlockMath keeps its own internal horizontal scroll and Mermaid scales
 * each diagram to fit its card.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/flex
 */
export function LayoutMaterialContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 flex-1", className)}>{children}</div>;
}
