import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

/**
 * Renders the flex shell shared by article, subject, exercise, and Quran pages.
 */
export function LayoutMaterial({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex", className)} {...props} />;
}
