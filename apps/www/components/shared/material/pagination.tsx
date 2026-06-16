import type { ComponentProps } from "react";
import { PaginationContent } from "@/components/shared/pagination-content";

/**
 * Renders previous and next material navigation.
 */
export function LayoutMaterialPagination({
  ...props
}: ComponentProps<typeof PaginationContent>) {
  return <PaginationContent {...props} />;
}
