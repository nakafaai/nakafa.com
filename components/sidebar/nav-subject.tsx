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
import { subjectAll } from "./data/subject";

function MenuItem() {
  const pathname = usePathname();
  const t = useTranslations("Subject");

  return subjectAll.map((item) => (
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
              let title = "";
              // Only grade that has value
              if ("value" in subItem) {
                title = t(subItem.title, { grade: subItem.value });
              } else {
                title = t(subItem.title);
              }

              return (
                <SidebarMenuSubItem key={title}>
                  <SidebarMenuSubButton asChild>
                    <NavigationLink href={subItem.href}>
                      <span>{title}</span>
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
