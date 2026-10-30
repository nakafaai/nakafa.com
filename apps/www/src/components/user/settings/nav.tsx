import {
  AiBrain01Icon,
  BookOpen02Icon,
  HeartAddIcon,
  Link01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";
import { SettingsBack } from "@/components/shared/settings/return";
import { Link, type LinkTarget, useRouteMatched } from "@/lib/routing/link";
import { HOME_TARGET } from "@/lib/routing/target";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";
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
  learning: BookOpen02Icon,
  billing: HeartAddIcon,
  memory: AiBrain01Icon,
  connectors: Link01Icon,
};

/**
 * Renders the private settings sections as the sidebar body for settings
 * routes, replacing the browsing navigation without replacing the shell.
 */
export function UserSettingsNav() {
  const t = useTranslations("Auth");

  return (
    <>
      <SettingsBack home={HOME_TARGET} label={t("back-to-nakafa")} />
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
  const t = useTranslations("Auth");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t(group.key)}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {Arr.map(group.sections, (section) => (
            <UserSettingsNavItem
              key={section.target.to}
              label={t(section.labelKey)}
              labelKey={section.labelKey}
              target={section.target}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** One settings section, active on its own page as the router's match says. */
function UserSettingsNavItem({
  label,
  labelKey,
  target,
}: {
  label: string;
  labelKey: UserSettingsLabelKey;
  target: LinkTarget;
}) {
  const isActive = useRouteMatched(target.to, { exact: true });

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <Link
            activeOptions={EXACT_ACTIVE_OPTIONS}
            {...target}
            title={label}
          />
        }
        tooltip={label}
      >
        <HugeIcons icon={sectionIcons[labelKey]} />
        <span className="truncate">{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
