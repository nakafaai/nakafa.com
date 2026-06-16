import type { ComponentProps } from "react";
import { HeaderContent } from "@/components/shared/header-content";

/**
 * Renders the material page header through the shared header adapter.
 */
export function LayoutMaterialHeader({
  ...props
}: ComponentProps<typeof HeaderContent>) {
  return <HeaderContent {...props} />;
}
