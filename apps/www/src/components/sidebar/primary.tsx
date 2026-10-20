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
  useCurrentLocale,
} from "@repo/internationalization/src/link";
import { useMatchRoute, useRouter } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import {
  getForYouNavigationItems,
  getForYouNavigationTarget,
} from "@/components/sidebar/data/navigation";
import { usePreferredCurriculumTarget } from "@/lib/curriculum/preferences";
import { usePreferredTryoutTarget } from "@/lib/tryout/preferences";

/**
 * Renders the primary app navigation shared by every audience.
 */
export function NavForYou() {
  const router = useRouter();
  const matchRoute = useMatchRoute();
  const tAi = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const locale = useCurrentLocale();
  const items = getForYouNavigationItems();
  const preferredCurriculumTarget = usePreferredCurriculumTarget(locale);
  const preferredTryoutTarget = usePreferredTryoutTarget(locale);

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
              preferredCurriculumTarget,
              preferredTryoutTarget,
            });
            const isAskNina = item.id === "askNina";
            // Every other row preloads on intent through its link; the chat
            // route also warms on focus and pointer, because its link does not.
            const prefetchAskNina = isAskNina
              ? () => router.preloadRoute(destination)
              : undefined;
            const isActive =
              matchRoute({ ...destination, fuzzy: true }) !== false;

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={isActive}
                  render={
                    <DestinationLink
                      activeOptions={EXACT_ACTIVE_OPTIONS}
                      destination={destination}
                      onFocus={prefetchAskNina}
                      onPointerEnter={prefetchAskNina}
                      onTouchStart={prefetchAskNina}
                      preload={isAskNina ? false : undefined}
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
