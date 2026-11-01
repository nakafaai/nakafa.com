import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { useSearch } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import type { InboxTopic } from "@/components/notifications/topic";
import { pageRowVariants } from "@/components/shared/content/width";
import { Link } from "@/lib/routing/link";

/** The tab the address names, All without one, so a reload and a shared link return to it. */
export function useInboxTopic(): typeof InboxTopic.Type {
  return (
    useSearch({ strict: false, select: (search) => search.topic }) ?? "all"
  );
}

/** The inbox's second header row, its tabs alone. */
export function InboxTabs({
  topics,
}: {
  /** The tabs this inbox has. */
  topics: readonly (typeof InboxTopic.Type)[];
}) {
  const t = useTranslations("Notifications");
  const topic = useInboxTopic();

  return (
    <Tabs value={topic}>
      <TabsList aria-label={t("topic-label")} className={pageRowVariants()}>
        {Arr.map(topics, (item) => (
          <TabsTab
            key={item}
            nativeButton={false}
            render={
              <Link
                replace={true}
                search={(previous) => ({
                  ...previous,
                  topic: item === "all" ? undefined : item,
                })}
                to="."
              >
                {t(`topic-${item}`)}
              </Link>
            }
            value={item}
          />
        ))}
      </TabsList>
    </Tabs>
  );
}
