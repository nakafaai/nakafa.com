"use client";

import { HeartAddIcon, UserIcon } from "@hugeicons/core-free-icons";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { SharedTabs } from "@/components/user/shared-tabs";

export function UserSettingsTabs() {
  const t = useTranslations("Auth");

  const pathname = usePathname();

  const tabs = useMemo(
    () => [
      {
        icon: UserIcon,
        label: t("account"),
        href: "/user/settings",
      },
      {
        icon: HeartAddIcon,
        label: t("subscriptions"),
        href: "/user/settings/subscriptions",
      },
    ],
    [t]
  );

  const defaultValue = useMemo(
    () => tabs.find((tab) => pathname === tab.href)?.href || tabs[0]?.href,
    [pathname, tabs]
  );

  return <SharedTabs defaultValue={defaultValue} tabs={tabs} />;
}
