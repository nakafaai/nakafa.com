import {
  AiBrain01Icon,
  ArrowLeft02Icon,
  BookOpen02Icon,
  HeartAddIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { useWindowEvent } from "@mantine/hooks";
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
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";
import { useSettingsReturn } from "@/components/user/settings/return";
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
};

/**
 * Renders the private settings sections as the sidebar body for settings
 * routes, replacing the browsing navigation without replacing the shell.
 */
export function UserSettingsNav() {
  return (
    <>
      <UserSettingsBack />
      {Arr.map(userSettingsGroups, (group) => (
        <UserSettingsNavGroup group={group} key={group.key} />
      ))}
    </>
  );
}

/** Whether a key press belongs to a field the learner is typing in. */
function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

/**
 * The way out of settings, above the first group: back to the page the learner
 * read before settings, or home when settings was the first page. Escape leaves
 * the same way, unless a field holds the key or an open popup closed with it,
 * which marks the press as handled before it reaches the window.
 */
function UserSettingsBack() {
  const t = useTranslations("Auth");
  const navigate = useNavigate();
  const page = useSettingsReturn();
  const label = t("back-to-nakafa");

  useWindowEvent("keydown", (event) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.isComposing ||
      isTyping(event.target)
    ) {
      return;
    }
    navigate(
      Option.match(page, {
        onNone: () => HOME_TARGET,
        onSome: (href) => ({ href }),
      })
    );
  });

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={Option.match(page, {
                onNone: () => <Link {...HOME_TARGET} title={label} />,
                onSome: (href) => <Link href={href} title={label} />,
              })}
              tooltip={label}
            >
              <HugeIcons icon={ArrowLeft02Icon} />
              <span className="truncate">{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
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
