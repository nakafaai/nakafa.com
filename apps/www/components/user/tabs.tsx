"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { MessageCircleIcon, MessagesSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { SharedTabs } from "@/components/user/shared-tabs";

export function UserTabs({ userId }: { userId: string }) {
  const t = useTranslations("Common");

  const pathname = usePathname();

  const tabs = useMemo(
    () => [
      {
        icon: MessagesSquareIcon,
        label: t("comments"),
        href: `/user/${userId}`,
      },
      {
        icon: MessageCircleIcon,
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
