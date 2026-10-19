"use client";

import {
  ArrowRight01Icon,
  Link01Icon,
  School01Icon,
  SecurityLockIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/design-system/components/ui/sidebar-submenu";
import { usePathname } from "@repo/internationalization/src/navigation";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { schoolSettingsGroups } from "@/lib/settings/school";

/** The icon of each group. A group added without one does not compile. */
const groupIcons: Record<
  (typeof schoolSettingsGroups)[number]["key"],
  ComponentProps<typeof HugeIcons>["icon"]
> = {
  integrations: Link01Icon,
  people: UserGroupIcon,
  school: School01Icon,
  security: SecurityLockIcon,
};

/**
 * Renders the school settings as the sidebar body for settings routes, replacing the
 * school's own navigation without replacing the shell: one Settings group whose
 * groups fold open into their sections, as shadcn's sidebar draws a menu with
 * submenus. The group that holds the current section opens, also when the current
 * section moves into it, as after the settings root sends the viewer to its first
 * section, or a link opens a section of another group. A school host
 * has no locale in its paths, so the links are plain Next.js links, as in the
 * school's own navigation.
 */
export function SchoolSettingsNav() {
  const t = useTranslations("SchoolSettings");

  return (
    <TenantSidebarGroup label={t("manage-settings")}>
      {Arr.map(schoolSettingsGroups, (group) => (
        <SchoolSettingsNavGroup group={group} key={group.key} />
      ))}
    </TenantSidebarGroup>
  );
}

/** One group of school settings: its name, which folds open into its sections. */
function SchoolSettingsNavGroup({
  group,
}: {
  group: (typeof schoolSettingsGroups)[number];
}) {
  const pathname = usePathname();
  const t = useTranslations("SchoolSettings");
  const label = t(group.key);
  const holdsCurrent = Arr.some(
    group.sections,
    (section) => section.href === pathname
  );

  // A new key starts the group again from its default when the current section
  // moves in or out of it, and leaves a group the viewer folded alone otherwise.
  return (
    <Collapsible
      className="group/collapsible"
      defaultOpen={holdsCurrent}
      key={String(holdsCurrent)}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger render={<SidebarMenuButton tooltip={label} />}>
        <HugeIcons icon={groupIcons[group.key]} />
        <span className="truncate">{label}</span>
        <HugeIcons
          className="ms-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
          icon={ArrowRight01Icon}
        />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <SidebarMenuSub>
          {Arr.map(group.sections, (section) => (
            <SidebarMenuSubItem key={section.href}>
              <SidebarMenuSubButton
                isActive={pathname === section.href}
                render={<IntentLink href={section.href} localized={false} />}
              >
                <span className="truncate">{t(section.labelKey)}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsiblePanel>
    </Collapsible>
  );
}
