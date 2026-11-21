import {
  createDropdownMenuController,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { ThemeMenuItems } from "@/components/shared/theme/items";

/**
 * The theme selector with its list, open from the press that loaded it. It opens from code as it mounts, so the list
 * takes the focus as a press would: a menu that renders open leaves the focus where it is.
 */
export function ThemeMenu({ children }: { children: ReactElement }) {
  const common = useTranslations("Common");
  const [controller] = useState(createDropdownMenuController);

  useEffect(() => {
    controller.setOpen(true);
  }, [controller]);

  return (
    <DropdownMenu controller={controller}>
      <DropdownMenuTrigger render={children} />
      <DropdownMenuContent
        align="end"
        className="max-h-[min(var(--available-height),24rem)] w-max max-w-[calc(100vw-2rem)]"
        label={common("menu-theme")}
      >
        <ThemeMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
