"use client";

import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useRouter } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { ConvexIsland } from "@/components/providers/island";
import {
  getPrimaryNavigationItems,
  getPrimaryNavigationTarget,
} from "@/components/sidebar/data/navigation";
import { usePreferredCurriculumTarget } from "@/lib/curriculum/preferences";
import {
  Link,
  type LinkTarget,
  useCurrentLocale,
  useRouteMatched,
} from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";
import { usePreferredTryoutTarget } from "@/lib/tryout/preferences";

type PrimaryItem = ReturnType<typeof getPrimaryNavigationItems>[number];

/**
 * Renders the primary app navigation shared by every audience, the first group of
 * the sidebar, which needs no label. Each shortcut is its own island, so the group
 * never remounts when the page's client arrives: a shortcut shows its shared
 * destination until the learner's preference is read.
 */
export function NavPrimary() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {Arr.map(getPrimaryNavigationItems(), (item) => (
            <PrimaryMenuItem item={item} key={item.id} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/** One shortcut, whose destination reads the learner's preferences on the page's Convex island. */
function PrimaryMenuItem({ item }: { item: PrimaryItem }) {
  return (
    <ConvexIsland
      fallback={
        <PrimaryLink
          destination={getPrimaryNavigationTarget(item)}
          item={item}
        />
      }
    >
      <LearnerPrimaryMenuItem item={item} />
    </ConvexIsland>
  );
}

/** Reads the learner's preferences on the page's Convex island. */
function LearnerPrimaryMenuItem({ item }: { item: PrimaryItem }) {
  const locale = useCurrentLocale();
  const preferredCurriculumTarget = usePreferredCurriculumTarget(locale);
  const preferredTryoutTarget = usePreferredTryoutTarget(locale);

  return (
    <PrimaryLink
      destination={getPrimaryNavigationTarget(item, {
        preferredCurriculumTarget,
        preferredTryoutTarget,
      })}
      item={item}
    />
  );
}

/** One shortcut row, which preloads the chat that the Ask Nina shortcut leads to on intent. */
function PrimaryLink({
  destination,
  item,
}: {
  destination: LinkTarget;
  item: PrimaryItem;
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
  const isActive = useRouteMatched(destination.to, { exact: false });

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
