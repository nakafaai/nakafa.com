"use client";

import { HeartAddIcon, UserIcon } from "@hugeicons/core-free-icons";
import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";

import { SharedTabs } from "@/components/user/shared-tabs";

export function UserSettingsTabs() {
  const t = useTranslations("Auth");

  const pathname = usePathname();

  const tabs = [
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
  ];

  const defaultValue =
    tabs.find((tab) => pathname === tab.href)?.href || tabs[0]?.href;

  return <SharedTabs defaultValue={defaultValue} tabs={tabs} />;
}
