import { ArrowRight01Icon, TranslateIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { useTranslations } from "next-intl";
import { LangMenuSwitcher } from "./lang-menu-switcher";

export function LangMenu() {
  const t = useTranslations("Common");

  return (
    <DropdownMenu>
      <SidebarMenuItem>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={t("language")}>
            <HugeIcons icon={TranslateIcon} />
            <span className="truncate">{t("language")}</span>

            <HugeIcons className="ml-auto" icon={ArrowRight01Icon} />
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <LangMenuSwitcher />
      </SidebarMenuItem>
    </DropdownMenu>
  );
}
