"use client";

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
import {
  DestinationLink,
  EXACT_ACTIVE_OPTIONS,
  useCanonicalPath,
  useCurrentLocale,
} from "@repo/internationalization/src/link";
import { useMatchRoute, useRouter } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import {
  getForYouNavigationItems,
  getForYouNavigationTarget,
} from "@/components/sidebar/data/navigation";
import { usePreferredCurriculumHref } from "@/lib/curriculum/preferences";
import { usePreferredTryoutHref } from "@/lib/tryout/preferences";

/**
 * Renders the primary app navigation shared by every audience.
 */
export function NavForYou() {
  const pathname = useCanonicalPath();
  const router = useRouter();
  const matchRoute = useMatchRoute();
  const tAi = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const locale = useCurrentLocale();
  const items = getForYouNavigationItems();
  const preferredCurriculumHref = usePreferredCurriculumHref(locale);
  const preferredTryoutHref = usePreferredTryoutHref(locale);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{tCommon("for-you")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {Arr.map(items, (item) => {
            const label =
              item.labelNamespace === "Ai"
                ? tAi(item.labelKey)
                : tCommon(item.labelKey);
            const destination = getForYouNavigationTarget(item, locale, {
              preferredCurriculumHref,
              preferredTryoutHref,
            });
            const prefetchChat =
              typeof destination === "string"
                ? undefined
                : () => router.preloadRoute(destination);
            const isActive =
              typeof destination === "string"
                ? pathname.includes(destination)
                : matchRoute({ ...destination, fuzzy: true }) !== false;

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={isActive}
                  render={
                    <DestinationLink
                      activeOptions={EXACT_ACTIVE_OPTIONS}
                      destination={destination}
                      onFocus={prefetchChat}
                      onPointerEnter={prefetchChat}
                      onTouchStart={prefetchChat}
                      preload={item.id === "askNina" ? false : undefined}
                      title={label}
                    />
                  }
                  tooltip={label}
                >
                  <HugeIcons icon={item.icon} />
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
