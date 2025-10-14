import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { CloverIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function AboutMenu() {
  const t = useTranslations("Common");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={t("about")}>
        <NavigationLink href="/about" title={t("about")}>
          <CloverIcon className="size-4 shrink-0" />
          <span className="truncate">{t("about")}</span>
        </NavigationLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
