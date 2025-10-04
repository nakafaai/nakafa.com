import { AnimateTabs } from "@repo/design-system/components/ui/animate-tabs";
import { MessagesSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function UserTabs({ userId }: { userId: string }) {
  const t = useTranslations("Common");

  const tabs = [
    {
      icon: MessagesSquareIcon,
      label: t("comments"),
      href: `/user/${userId}`,
    },
  ];

  return (
    <div className="border-b">
      <AnimateTabs tabs={tabs} />
    </div>
  );
}
