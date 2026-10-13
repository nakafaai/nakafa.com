"use client";

import { BubbleChatSparkIcon, Comment01Icon } from "@hugeicons/core-free-icons";
import { usePathname } from "@repo/internationalization/src/navigation";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";

import { SharedTabs } from "@/components/user/navigation";
import { profileHref } from "@/lib/profile/href";

export function UserTabs({ username }: { username: string }) {
  const t = useTranslations("Common");

  const pathname = usePathname();

  const tabs = [
    {
      icon: Comment01Icon,
      label: t("comments"),
      href: profileHref(username),
    },
    {
      icon: BubbleChatSparkIcon,
      label: t("chat"),
      href: `${profileHref(username)}/chat`,
    },
  ];

  const activeTab = Arr.findFirst(tabs, (tab) => pathname === tab.href);
  const value = Option.match(activeTab, {
    onNone: () => tabs[0]?.href,
    onSome: (tab) => tab.href || tabs[0]?.href,
  });

  return <SharedTabs tabs={tabs} value={value} />;
}
