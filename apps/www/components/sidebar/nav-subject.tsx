"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/design-system/components/ui/sidebar";
import { usePathname } from "@repo/internationalization/src/navigation";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { subjectAll } from "./_data/subject";

function MenuItem() {
  const pathname = usePathname();
  const t = useTranslations("Subject");

  return (
    <SidebarMenu>
      {subjectAll.map((item) => (
        <Collapsible
          key={item.title}
          asChild
          defaultOpen
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
                  }

                  return (
                    <SidebarMenuSubItem key={title}>
                      <SidebarMenuSubButton
                        isActive={pathname.includes(subItem.href)}
                        asChild
                      >
                        <NavigationLink href={subItem.href} title={title}>
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
      ))}
    </SidebarMenu>
  );
}

export function NavSubject() {
  const t = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("subject")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <MenuItem />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
