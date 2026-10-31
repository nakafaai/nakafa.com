import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { InboxTopic } from "@/components/notifications/topic";
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

/** The inbox's second header row, its tabs alone. The address keeps the tab, so back and a reload return to it. */
export function InboxTabs({
  topic,
  width,
}: {
  topic: typeof InboxTopic.Type;
} & VariantProps<typeof inboxTabsVariants>) {
  const t = useTranslations("Notifications");

  return (
    <Tabs value={topic}>
      <TabsList
        aria-label={t("topic-label")}
        className={inboxTabsVariants({ width })}
      >
        {Arr.map(InboxTopic.literals, (item) => (
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
