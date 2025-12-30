"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import { useTranslations } from "next-intl";
import { exercisesMenu } from "./_data/exercises";

function MenuItem() {
  const pathname = usePathname();
  const t = useTranslations("Exercises");

  return (
    <SidebarMenu>
      {exercisesMenu.map((item) => (
        <Collapsible
          key={item.title}
          render={
            <SidebarMenuItem>
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton className="group" tooltip={t(item.title)}>
                    {!!item.icon && <HugeIcons icon={item.icon} />}
                    <span className="truncate">{t(item.title)}</span>
                    <HugeIcons
                      className="ml-auto transition-transform duration-200 group-data-panel-open:rotate-90"
                      icon={ArrowRight01Icon}
                    />
                  </SidebarMenuButton>
                }
              />
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items.map((subItem) => {
                    const title = t(subItem.title);

                    return (
                      <SidebarMenuSubItem key={title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname.includes(subItem.href)}
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
          }
        />
      ))}
    </SidebarMenu>
  );
}

export function NavExercises() {
  const t = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("exercises")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <MenuItem />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
