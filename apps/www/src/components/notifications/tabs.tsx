import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { useSearch } from "@tanstack/react-router";
import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import type { InboxTopic } from "@/components/notifications/topic";
import { Link } from "@/lib/routing/link";

/** The bar's column, so its first tab's text lines up with the header above it. */
const inboxTabsVariants = cva("mx-auto", {
  variants: {
    width: {
      column: "max-w-3xl px-1 sm:px-3",
      page: "max-w-7xl px-1",
    },
  },
});

/** The tab the address names, All without one, so a reload and a shared link return to it. */
export function useInboxTopic(): typeof InboxTopic.Type {
  return (
    useSearch({ strict: false, select: (search) => search.topic }) ?? "all"
  );
}

/** The inbox's second header row, its tabs alone. */
export function InboxTabs({
  topics,
  width,
}: {
  /** The tabs this inbox has. */
  topics: readonly (typeof InboxTopic.Type)[];
} & VariantProps<typeof inboxTabsVariants>) {
  const t = useTranslations("Notifications");
  const topic = useInboxTopic();

  return (
    <Tabs value={topic}>
      <TabsList
        aria-label={t("topic-label")}
        className={inboxTabsVariants({ width })}
      >
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
