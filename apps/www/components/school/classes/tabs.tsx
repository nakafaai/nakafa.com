"use client";

import {
  AssignmentsIcon,
  BookOpen02Icon,
  MessageMultiple02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Link, usePathname } from "@repo/internationalization/src/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

export function SchoolClassesTabs() {
  const params = useParams<{ slug: string; id: string }>();
  const { slug, id } = params;
  const pathname = usePathname();

  const t = useTranslations("School.Classes");

  const tabs = [
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
      icon: AssignmentsIcon,
      label: t("assessments"),
      href: `/school/${slug}/classes/${id}/assessments`,
    },
    {
      icon: UserMultipleIcon,
      label: t("people"),
      href: `/school/${slug}/classes/${id}/people`,
    },
  ];

  const value =
    tabs.find(
      (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
    )?.href || tabs[0]?.href;

  return (
    <div className="sticky top-0 z-10 -mt-2 flex h-12 w-full shrink-0 border-b bg-background">
      <div className="mx-auto flex w-full max-w-3xl items-center">
        <div className="scrollbar-hide flex w-full overflow-x-auto px-6">
          <Tabs className="contents" value={value}>
            <TabsList className="bg-transparent p-0 [&_[data-slot=tab-indicator]]:bg-accent">
              {tabs.map((tab) => (
                <TabsTab
                  className="h-8 px-3 text-muted-foreground data-active:text-accent-foreground"
                  key={tab.href}
                  render={
                    <Link href={tab.href} prefetch>
                      <HugeIcons className="size-4" icon={tab.icon} />
                      {tab.label}
                    </Link>
                  }
                  value={tab.href}
                />
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
