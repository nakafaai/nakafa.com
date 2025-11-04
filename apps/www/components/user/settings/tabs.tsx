"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { CodeIcon, HeartPlusIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { SharedTabs } from "@/components/user/shared-tabs";

export function UserSettingsTabs() {
  const t = useTranslations("Auth");

  const pathname = usePathname();

  const tabs = useMemo(
    () => [
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
      {
        icon: CodeIcon,
        label: t("developers"),
        href: "/user/settings/developers",
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
