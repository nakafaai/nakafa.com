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
  EXACT_ACTIVE_OPTIONS,
  Link,
  type LinkTarget,
  useCurrentLocale,
  useRouteMatched,
} from "@repo/internationalization/src/link";
import { useRouter } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { ConvexIsland } from "@/components/providers/island";
import {
  getForYouNavigationItems,
  getForYouNavigationTarget,
} from "@/components/sidebar/data/navigation";
import { usePreferredCurriculumTarget } from "@/lib/curriculum/preferences";
import { usePreferredTryoutTarget } from "@/lib/tryout/preferences";

type ForYouItem = ReturnType<typeof getForYouNavigationItems>[number];

/**
 * Renders the primary app navigation shared by every audience. Each shortcut is
 * its own island, so the group never remounts when the page's client arrives: a
 * shortcut shows its shared destination until the learner's preference is read.
 */
export function NavForYou() {
  const tCommon = useTranslations("Common");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{tCommon("for-you")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {Arr.map(getForYouNavigationItems(), (item) => (
            <ForYouMenuItem item={item} key={item.id} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** One shortcut, whose destination reads the learner's preferences on the page's Convex island. */
function ForYouMenuItem({ item }: { item: ForYouItem }) {
  return (
    <ConvexIsland
      fallback={
        <ForYouLink destination={getForYouNavigationTarget(item)} item={item} />
      }
    >
      <LearnerForYouMenuItem item={item} />
    </ConvexIsland>
  );
}

/** Reads the learner's preferences on the page's Convex island. */
function LearnerForYouMenuItem({ item }: { item: ForYouItem }) {
  const locale = useCurrentLocale();
  const preferredCurriculumTarget = usePreferredCurriculumTarget(locale);
  const preferredTryoutTarget = usePreferredTryoutTarget(locale);

  return (
    <ForYouLink
      destination={getForYouNavigationTarget(item, {
        preferredCurriculumTarget,
        preferredTryoutTarget,
      })}
      item={item}
    />
  );
}

/** One shortcut row, which preloads the chat that the Ask Nina shortcut leads to on intent. */
function ForYouLink({
  destination,
  item,
}: {
  destination: LinkTarget;
  item: ForYouItem;
}) {
  const router = useRouter();
  const tAi = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const label =
    item.labelNamespace === "Ai" ? tAi(item.labelKey) : tCommon(item.labelKey);
  const isAskNina = item.id === "askNina";
  // Every other row preloads on intent through its link; the chat route also
  // warms on focus and pointer, because its link does not.
  const prefetchAskNina = isAskNina
    ? () => router.preloadRoute(destination)
    : undefined;
  const isActive = useRouteMatched(destination.to);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <Link
            activeOptions={EXACT_ACTIVE_OPTIONS}
            {...destination}
            onFocus={prefetchAskNina}
            onPointerEnter={prefetchAskNina}
            onTouchStart={prefetchAskNina}
            {...(isAskNina && { preload: false })}
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
}
