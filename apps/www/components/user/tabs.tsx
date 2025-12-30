"use client";

import {
  MessageMultiple01Icon,
  MessageMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { SharedTabs } from "@/components/user/shared-tabs";

export function UserTabs({ userId }: { userId: string }) {
  const t = useTranslations("Common");

  const pathname = usePathname();

  const tabs = useMemo(
    () => [
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
    ],
    [userId, t]
  );

  const defaultValue = useMemo(
    () => tabs.find((tab) => pathname === tab.href)?.href || tabs[0]?.href,
    [pathname, tabs]
  );

  return <SharedTabs defaultValue={defaultValue} tabs={tabs} />;
}
