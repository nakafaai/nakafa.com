"use client";

import { usePathname } from "@/i18n/routing";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import NavigationLink from "../ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "../ui/sidebar";
import { subjectMenu } from "./data/subject";

function MenuItem() {
  const pathname = usePathname();
  const t = useTranslations("Material");

  return subjectMenu.map((item) => (
    <Collapsible
      key={item.title}
      asChild
      defaultOpen={pathname.includes(item.title)}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={t(item.title)}>
            {item.icon && <item.icon />}
            <span className="truncate">{t(item.title)}</span>
            <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items.map((subItem) => {
              const grade = t(subItem.title, { grade: subItem.value });

              return (
                <SidebarMenuSubItem key={grade}>
                  <SidebarMenuSubButton asChild>
                    <NavigationLink href={subItem.href}>
                      <span>{grade}</span>
                    </NavigationLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  ));
}

export function NavSubject() {
  const t = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("subject")}</SidebarGroupLabel>
      <SidebarMenu>
        <MenuItem />
      </SidebarMenu>
    </SidebarGroup>
  );
}
