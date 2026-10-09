"use client";

import {
  MessageMultiple01Icon,
  MessageMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { usePathname } from "@repo/internationalization/src/navigation";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";

import { SharedTabs } from "@/components/user/navigation";

export function UserTabs({ userId }: { userId: string }) {
  const t = useTranslations("Common");

  const pathname = usePathname();

  const tabs = [
    {
      icon: MessageMultiple01Icon,
      label: t("comments"),
      href: `/user/${userId}`,
    },
    {
      icon: MessageMultiple02Icon,
      label: t("chat"),
      href: `/user/${userId}/chat`,
    },
  ];

  const activeTab = Arr.findFirst(tabs, (tab) => pathname === tab.href);
  const value = Option.match(activeTab, {
    onNone: () => tabs[0]?.href,
    onSome: (tab) => tab.href || tabs[0]?.href,
  });

  return <SharedTabs tabs={tabs} value={value} />;
}
