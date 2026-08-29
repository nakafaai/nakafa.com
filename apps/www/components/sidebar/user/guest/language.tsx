"use client";

import { TranslateIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import { useTranslations } from "next-intl";
import { LanguageMenuItems } from "@/components/sidebar/preference-submenus";

/** Renders the locale switcher available before a visitor signs in. */
export function NavUserGuestLanguage() {
  const t = useTranslations("Common");
  const { isMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton title={t("language")}>
              <HugeIcons icon={TranslateIcon} />
              <span>{t("language")}</span>
            </SidebarMenuButton>
          }
        />
        <DropdownMenuContent
          align="start"
          className="w-max max-w-[calc(100vw-2rem)]"
          side={isMobile ? "top" : "right"}
          sideOffset={4}
        >
          <DropdownMenuGroup>
            <LanguageMenuItems />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
