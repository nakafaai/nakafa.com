import type { ComponentProps, ReactNode } from "react";
import { LayoutContent } from "@/components/shared/layout-content";

/**
 * Renders the primary readable content area for material pages.
 */
export function LayoutMaterialMain({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & ComponentProps<typeof LayoutContent>) {
  return (
    <LayoutContent {...props} className={className}>
      {children}
    </LayoutContent>
  );
}
