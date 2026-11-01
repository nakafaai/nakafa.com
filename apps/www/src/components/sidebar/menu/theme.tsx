import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSubContent,
} from "@repo/design-system/components/ui/dropdown-menu";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";
import { ThemeMenuItems } from "@/components/shared/theme/items";

/**
 * Renders the nested theme submenu on the side the sidebar opens its menus. It
 * stays mounted while closed, so the menu that holds it has its themes ready when
 * the reader hovers Theme.
 */
export function ThemeSubmenuContent({
  side,
}: {
  side: ComponentProps<typeof DropdownMenuSubContent>["side"];
}) {
  const common = useTranslations("Common");
  return (
    <DropdownMenuSubContent
      className="max-h-[min(var(--available-height),24rem)] w-max max-w-[calc(100vw-2rem)]"
      keepMounted
      side={side}
    >
      <DropdownMenuGroup>
        <DropdownMenuLabel>{common("menu-theme")}</DropdownMenuLabel>
        <ThemeMenuItems />
      </DropdownMenuGroup>
    </DropdownMenuSubContent>
  );
}
