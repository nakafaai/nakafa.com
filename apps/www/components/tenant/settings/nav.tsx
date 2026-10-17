"use client";

import {
  Analytics01Icon,
  Clock04Icon,
  Link01Icon,
  Mail01Icon,
  School01Icon,
  Settings01Icon,
  StudentIcon,
  TeacherIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { usePathname } from "@repo/internationalization/src/navigation";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { TenantSidebarGroup } from "@/components/tenant/group";
import {
  type SchoolSettingsLabelKey,
  schoolSettingsGroups,
} from "@/lib/settings/school";

/** The icon of each section. A section added without one does not compile. */
const sectionIcons: Record<
  SchoolSettingsLabelKey,
  ComponentProps<typeof HugeIcons>["icon"]
> = {
  audit: Analytics01Icon,
  clients: Link01Icon,
  invites: Mail01Icon,
  periods: Clock04Icon,
  policies: Settings01Icon,
  profile: UserIcon,
  roles: TeacherIcon,
  students: StudentIcon,
  units: School01Icon,
};

/**
 * Renders the school settings sections as the sidebar body for settings routes,
 * replacing the school's own navigation without replacing the shell.
 */
export function SchoolSettingsNav() {
  return (
    <>
      {Arr.map(schoolSettingsGroups, (group) => (
        <SchoolSettingsNavGroup group={group} key={group.key} />
      ))}
    </>
  );
}

/** Renders one labelled group of school settings sections. */
function SchoolSettingsNavGroup({
  group,
}: {
  group: (typeof schoolSettingsGroups)[number];
}) {
  const pathname = usePathname();
  const t = useTranslations("SchoolSettings");

  return (
    <TenantSidebarGroup label={t(group.key)}>
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
    </TenantSidebarGroup>
  );
}
