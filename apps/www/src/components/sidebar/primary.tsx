"use client";

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
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { ConvexIsland } from "@/components/providers/island";
import {
  getForYouNavigationHref,
  getForYouNavigationItems,
} from "@/components/sidebar/data/navigation";
import { usePreferredCurriculumHref } from "@/lib/curriculum/preferences";
import { usePreferredTryoutHref } from "@/lib/tryout/preferences";

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
  const locale = useLocale();

  return (
    <ConvexIsland
      fallback={
        <ForYouLink href={getForYouNavigationHref(item, locale)} item={item} />
      }
    >
      <LearnerForYouMenuItem item={item} />
    </ConvexIsland>
  );
}

/** Reads the learner's preferences on the page's Convex island. */
function LearnerForYouMenuItem({ item }: { item: ForYouItem }) {
  const locale = useLocale();
  const preferredCurriculumHref = usePreferredCurriculumHref(locale);
  const preferredTryoutHref = usePreferredTryoutHref(locale);

  return (
    <ForYouLink
      href={getForYouNavigationHref(item, locale, {
        preferredCurriculumHref,
        preferredTryoutHref,
      })}
      item={item}
    />
  );
}

/** One shortcut row, which prefetches the chat that the Ask Nina shortcut leads to. */
function ForYouLink({
  href,
  item,
}: {
  href: ReturnType<typeof getForYouNavigationHref>;
  item: ForYouItem;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tAi = useTranslations("Ai");
  const tCommon = useTranslations("Common");
  const label =
    item.labelNamespace === "Ai" ? tAi(item.labelKey) : tCommon(item.labelKey);
  const prefetchChat =
    item.id === "askNina" ? () => router.prefetch(href) : undefined;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={pathname.includes(href)}
        render={
          <NavigationLink
            href={href}
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
}
