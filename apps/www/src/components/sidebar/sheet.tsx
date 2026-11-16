import type { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar-shell";
import type { ComponentProps } from "react";

/**
 * The page header's toggle of a panel on the right side of a page. Below 1280 px
 * the panel is a sheet that this toggle opens. From 1280 px the panel stands
 * beside the page with its own toggle at its foot, so the header shows none.
 */
export function PanelSheetTrigger({
  icon,
  label,
}: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  label: string;
}) {
  return (
    <SidebarTrigger
      className="xl:hidden"
      data-hides="xl"
      icon={icon}
      label={label}
      size="icon"
      variant="outline"
    />
  );
}
