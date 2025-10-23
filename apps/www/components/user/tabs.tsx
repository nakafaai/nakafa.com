"use client";

import { MessagesSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { SharedTabs } from "@/components/user/shared-tabs";

export function UserTabs({ userId }: { userId: string }) {
  const t = useTranslations("Common");

  const tabs = [
    {
      icon: MessagesSquareIcon,
      label: t("comments"),
      href: `/user/${userId}`,
    },
  ];

  return <SharedTabs tabs={tabs} />;
}
