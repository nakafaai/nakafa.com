import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import type { ReactElement } from "react";
import { useTranslations } from "use-intl";
import { ThemeMenuItems } from "@/components/shared/theme/items";

/** The theme selector with its list, open from the press that loaded it. */
export function ThemeMenu({ children }: { children: ReactElement }) {
  const common = useTranslations("Common");
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger render={children} />
      <DropdownMenuContent
        align="end"
        className="max-h-[min(var(--available-height),24rem)] w-max max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{common("menu-theme")}</DropdownMenuLabel>
          <ThemeMenuItems />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
