import { DropdownMenuSubContent } from "@repo/design-system/components/ui/dropdown-menu";
import { useTranslations } from "use-intl";
import { ThemeMenuItems } from "@/components/shared/theme/items";

/**
 * Renders the nested theme submenu beside its trigger, or in the menu's place on a
 * phone's sheet. It stays mounted while closed, so the menu that holds it has its
 * themes ready when the reader hovers Theme.
 */
export function ThemeSubmenuContent() {
  const common = useTranslations("Common");
  return (
    <DropdownMenuSubContent
      className="max-h-[min(var(--available-height),24rem)] w-max max-w-[calc(100vw-2rem)]"
      keepMounted
      label={common("menu-theme")}
    >
      <ThemeMenuItems />
    </DropdownMenuSubContent>
  );
}
