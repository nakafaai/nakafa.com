"use client";

import { ArrowRight01Icon, TranslateIcon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Menu, MenuTrigger } from "@repo/design-system/components/ui/menu";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { useTranslations } from "next-intl";
import { LangMenuSwitcher } from "@/components/sidebar/lang-menu-switcher";

/**
 * Renders the sidebar language menu.
 */
export function LangMenu() {
  const t = useTranslations("Common");
  const [open, { set }] = useDisclosure(false);

  return (
    <Menu onOpenChange={set} open={open}>
      <SidebarMenuItem>
        <MenuTrigger
          render={
            <SidebarMenuButton tooltip={t("language")}>
              <HugeIcons icon={TranslateIcon} />
              <span className="truncate">{t("language")}</span>

              <HugeIcons className="ml-auto" icon={ArrowRight01Icon} />
            </SidebarMenuButton>
          }
        />

        <LangMenuSwitcher />
      </SidebarMenuItem>
    </Menu>
  );
}
