"use client";

import { HeartPlusIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SharedTabs } from "@/components/user/shared-tabs";

export function UserSettingsTabs() {
  const t = useTranslations("Auth");

  const tabs = [
    {
      icon: UserRoundIcon,
      label: t("account"),
      href: "/user/settings",
    },
    {
      icon: HeartPlusIcon,
      label: t("subscriptions"),
      href: "/user/settings/subscriptions",
    },
  ];

  return <SharedTabs defaultValue="/user/settings" tabs={tabs} />;
}
