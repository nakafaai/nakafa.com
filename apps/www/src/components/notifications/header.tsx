import type { Option } from "effect";
import { useTranslations } from "use-intl";
import {
  type InboxFirstPage,
  useInbox,
} from "@/components/notifications/inbox";
import { MarkAllRead } from "@/components/notifications/read";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { HOME_TARGET } from "@/lib/routing/target";

/**
 * The sticky breadcrumb header of the inbox, as every account page has it, with the
 * inbox's one action, marking every row read, at its end while the inbox has rows.
 */
export function NotificationsHeader({
  first,
}: {
  first: Option.Option<InboxFirstPage>;
}) {
  const t = useTranslations("Notifications");
  const { rows } = useInbox(first, undefined);
  const tCommon = useTranslations("Common");

  return (
    <BreadcrumbHeader
      value={{
        action:
          rows.length > 0 ? (
            <MarkAllRead first={first} slug={undefined} />
          ) : undefined,
        home: HOME_TARGET,
        homeLabel: tCommon("home"),
        items: [{ label: t("title") }],
        menuLabel: tCommon("more"),
        title: t("title"),
      }}
    />
  );
}
