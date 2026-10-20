import { usePathname } from "@repo/internationalization/src/navigation";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";

import { SharedTabs } from "@/components/user/navigation";
import { ProfileTab, profileHref } from "@/lib/profile/href";

export function UserTabs({
  isOwner,
  username,
}: {
  isOwner: boolean;
  username: string;
}) {
  const t = useTranslations("Common");

  const pathname = usePathname();
  // The label of each tab the address names, so a tab without a label does not
  // compile.
  const labels: Record<typeof ProfileTab.Type, string> = {
    chat: t("chat"),
    comments: t("comments"),
  };
  // A profile never lists another learner's chats, so the Chat tab is the
  // owner's alone.
  const tabsShown = Arr.filter(
    ProfileTab.literals,
    (tab) => isOwner || tab !== "chat"
  );
  const tabs = [
    {
      label: t("posts"),
      href: profileHref(username),
    },
    ...Arr.map(tabsShown, (tab) => ({
      label: labels[tab],
      href: `${profileHref(username)}/${tab}`,
    })),
  ];

  const activeTab = Arr.findFirst(tabs, (tab) => pathname === tab.href);
  const value = Option.match(activeTab, {
    onNone: () => tabs[0]?.href,
    onSome: (tab) => tab.href,
  });

  return <SharedTabs tabs={tabs} value={value} />;
}
