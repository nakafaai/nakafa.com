"use client";

import {
  BookOpen02Icon,
  MessageMultiple02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { Highlight } from "@repo/design-system/components/animate-ui/primitives/effects/highlight";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

export function SchoolClassesTabs() {
  const params = useParams<{ slug: string; id: string }>();
  const { slug, id } = params;
  const pathname = usePathname();

  const t = useTranslations("School.Classes");

  const tabs = useMemo(
    () => [
      {
        icon: MessageMultiple02Icon,
        label: t("forum"),
        href: `/school/${slug}/classes/${id}/forum`,
      },
      {
        icon: BookOpen02Icon,
        label: t("materials"),
        href: `/school/${slug}/classes/${id}/materials`,
      },
      {
        icon: UserMultipleIcon,
        label: t("people"),
        href: `/school/${slug}/classes/${id}/people`,
      },
    ],
    [slug, id, t]
  );

  const defaultValue = useMemo(
    () => tabs.find((tab) => pathname === tab.href)?.href || tabs[0]?.href,
    [pathname, tabs]
  );

  return (
    <div className="sticky top-0 z-10 -mt-2 flex h-12 w-full shrink-0 border-b bg-background">
      <div className="mx-auto flex w-full max-w-3xl items-center">
        <div className="scrollbar-hide flex w-full overflow-x-auto px-6">
          <Highlight
            className="inset-0 rounded-md bg-accent"
            defaultValue={defaultValue}
          >
            {tabs.map((tab) => (
              <NavigationLink
                className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-3 text-muted-foreground text-sm transition-colors data-[active=true]:text-accent-foreground"
                data-value={tab.href}
                href={tab.href}
                key={tab.href}
              >
                <HugeIcons className="size-4" icon={tab.icon} />
                {tab.label}
              </NavigationLink>
            ))}
          </Highlight>
        </div>
      </div>
    </div>
  );
}
