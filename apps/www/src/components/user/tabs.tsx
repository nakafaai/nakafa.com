import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { SharedTabs } from "@/components/user/navigation";
import {
  ProfileTab,
  profileTabTarget,
  profileTarget,
} from "@/lib/profile/href";
import { useLeafRoutePath } from "@/lib/routing/link";

export function UserTabs({
  isOwner,
  username,
}: {
  isOwner: boolean;
  username: string;
}) {
  const t = useTranslations("Common");
  const leafPath = useLeafRoutePath();
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
      key: "posts",
      label: t("posts"),
      target: profileTarget(username),
    },
    ...Arr.map(tabsShown, (tab) => ({
      key: tab,
      label: labels[tab],
      target: profileTabTarget(tab, username),
    })),
  ];

  const activeTab = Arr.findFirst(tabs, (tab) => tab.target.to === leafPath);
  const value = Option.match(activeTab, {
    onNone: () => "posts",
    onSome: (tab) => tab.key,
  });

  return <SharedTabs tabs={tabs} value={value} />;
}
