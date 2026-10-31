import type { Option } from "effect";
import { useTranslations } from "use-intl";
import type { InboxFirstPage } from "@/components/notifications/inbox";
import { MarkAllRead } from "@/components/notifications/read";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { HOME_TARGET } from "@/lib/routing/target";

/**
 * The sticky breadcrumb header of the inbox, as every account page has it, with the
 * inbox's one action, marking every row read, at its end.
 */
export function NotificationsHeader({
  first,
}: {
  first: Option.Option<InboxFirstPage>;
}) {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");

  return (
    <BreadcrumbHeader
      value={{
        action: <MarkAllRead first={first} slug={undefined} />,
        home: HOME_TARGET,
        homeLabel: tCommon("home"),
        items: [{ label: t("title") }],
        title: t("title"),
      }}
    />
  );
}
