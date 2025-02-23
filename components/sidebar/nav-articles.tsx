import { useTranslations } from "next-intl";
import NavigationLink from "../ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { articlesMenu } from "./data/articles";

function MenuItem() {
  const t = useTranslations("Articles");

  return articlesMenu.map((item) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton tooltip={t(item.title)} asChild>
        <NavigationLink href={item.href}>
          {item.icon && <item.icon />}
          <span className="truncate">{t(item.title)}</span>
        </NavigationLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));
}

export function NavArticles() {
  const t = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("articles")}</SidebarGroupLabel>
      <SidebarMenu>
        <MenuItem />
      </SidebarMenu>
    </SidebarGroup>
  );
}
