"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";

import { SharedTabs } from "@/components/user/navigation";
import { ProfileTab, profileHref } from "@/lib/profile/href";

export function UserTabs({ username }: { username: string }) {
  const t = useTranslations("Common");

  const pathname = usePathname();
  // The label of each tab the address names, so a tab without a label does not
  // compile.
  const labels: Record<typeof ProfileTab.Type, string> = {
    chat: t("chat"),
    comments: t("comments"),
  };
  const tabs = [
    {
      label: t("posts"),
      href: profileHref(username),
    },
    ...Arr.map(ProfileTab.literals, (tab) => ({
      label: labels[tab],
      href: `${profileHref(username)}/${tab}`,
    })),
  ];

  const activeTab = Arr.findFirst(tabs, (tab) => pathname === tab.href);
  const value = Option.match(activeTab, {
    onNone: () => tabs[0]?.href,
    onSome: (tab) => tab.href || tabs[0]?.href,
  });

  return <SharedTabs tabs={tabs} value={value} />;
}
