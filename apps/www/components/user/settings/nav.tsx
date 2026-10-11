"use client";

import {
  AiBrain01Icon,
  HeartAddIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { usePathname } from "@repo/internationalization/src/navigation";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import {
  type UserSettingsLabelKey,
  userSettingsGroups,
} from "@/lib/settings/routes";

/** The icon of each section. A section added without one does not compile. */
const sectionIcons: Record<
  UserSettingsLabelKey,
  ComponentProps<typeof HugeIcons>["icon"]
> = {
  account: UserIcon,
  billing: HeartAddIcon,
  memory: AiBrain01Icon,
};

/**
 * Renders the private settings sections as the sidebar body for settings
 * routes, replacing the browsing navigation without replacing the shell.
 */
export function UserSettingsNav() {
  return (
    <>
      {Arr.map(userSettingsGroups, (group) => (
        <UserSettingsNavGroup group={group} key={group.key} />
      ))}
    </>
  );
}

/** Renders one labelled group of settings sections. */
function UserSettingsNavGroup({
  group,
}: {
  group: (typeof userSettingsGroups)[number];
}) {
  const pathname = usePathname();
  const t = useTranslations("Auth");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t(group.key)}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {Arr.map(group.sections, (section) => {
            const label = t(section.labelKey);

            return (
              <SidebarMenuItem key={section.href}>
                <SidebarMenuButton
                  isActive={pathname === section.href}
                  render={<NavigationLink href={section.href} title={label} />}
                  tooltip={label}
                >
                  <HugeIcons icon={sectionIcons[section.labelKey]} />
                  <span className="truncate">{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
