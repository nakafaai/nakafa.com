import { useTranslations } from "next-intl";
import NavigationLink from "../ui/navigation-link";
import {
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

import { SidebarMenu } from "../ui/sidebar";

import { SidebarGroup } from "../ui/sidebar";

export type OnThisPage = {
  label: string;
  href: string;
}[];

type Props = {
  data: OnThisPage;
};

export function OnThisPage({ data }: Props) {
  const t = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("on-this-page")}</SidebarGroupLabel>
      <SidebarMenu>
        {data.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton tooltip={item.label} asChild>
              <NavigationLink href={item.href.toLowerCase().replace(/ /g, "-")}>
                <span className="truncate">{item.label}</span>
              </NavigationLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
