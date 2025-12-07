"use client";

import { Highlight } from "@repo/design-system/components/animate-ui/primitives/effects/highlight";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { usePathname } from "@repo/internationalization/src/navigation";
import { MessagesSquareIcon, UsersIcon } from "lucide-react";
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
        icon: MessagesSquareIcon,
        label: t("forum"),
        href: `/school/${slug}/classes/${id}/forum`,
      },
      {
        icon: UsersIcon,
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
    <div className="-mt-2.5 sticky top-0 z-10 flex h-12 w-full shrink-0 border-b bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center">
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
                <tab.icon className="size-4 shrink-0" />
                {tab.label}
              </NavigationLink>
            ))}
          </Highlight>
        </div>
      </div>
    </div>
  );
}
