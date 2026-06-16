import type { ComponentProps } from "react";
import { FooterContent } from "@/components/shared/footer-content";

/**
 * Renders the material page footer through the shared footer adapter.
 */
export function LayoutMaterialFooter({
  ...props
}: ComponentProps<typeof FooterContent>) {
  return <FooterContent {...props} />;
}
