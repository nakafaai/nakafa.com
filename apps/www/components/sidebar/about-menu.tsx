import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { useTranslations } from "next-intl";

export function AboutMenu() {
  const t = useTranslations("Common");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={t("about")}>
        <NavigationLink href="/about" title={t("about")}>
          <HugeIcons icon={FavouriteIcon} />
          <span className="truncate">{t("about")}</span>
        </NavigationLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
