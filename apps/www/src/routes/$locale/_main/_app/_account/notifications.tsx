import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { createFileRoute } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import { AccountPreferences } from "@/components/notifications/account";
import { NotificationsClockContext } from "@/components/notifications/clock";
import { NotificationsHeader } from "@/components/notifications/header";
import { ACCOUNT_INBOX } from "@/components/notifications/inbox";
import { NotificationsList } from "@/components/notifications/list";
import { MarkAllRead } from "@/components/notifications/read";
import { InboxTabs } from "@/components/notifications/tabs";
import { InboxTopic } from "@/components/notifications/topic";
import { LayoutContent } from "@/components/shared/content/frame";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { useAgeClock } from "@/components/user/ages";
import { signedInHead } from "@/lib/account/head";
import { notificationsScreenFn } from "@/lib/account/home.functions";

/** The tab the address names, All without one. */
const NotificationsSearch = Schema.Struct({
  topic: Schema.optionalKey(InboxTopic),
});

export const Route = createFileRoute(
  "/$locale/_main/_app/_account/notifications"
)({
  validateSearch: Schema.toStandardSchemaV1(NotificationsSearch),
  loader: ({ params }) =>
    notificationsScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : signedInHead(loaderData.seo),
  component: NotificationsPage,
});

/**
 * The inbox of the signed-in account, in the app shell. Every age in it counts from
 * one clock, which a timer moves forward each minute, and the header and the list
 * read the loader's first page until the live inbox answers.
 */
function NotificationsPage() {
  const { first, now } = Route.useLoaderData();
  const page = Option.fromUndefinedOr(first);
  const clock = useAgeClock(now);
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <NotificationsHeader>
          <ButtonGroup>
            <MarkAllRead first={page} scope={ACCOUNT_INBOX} />
            <AccountPreferences />
          </ButtonGroup>
        </NotificationsHeader>
        <InboxTabs topics={InboxTopic.literals} />
        <LayoutContent className="flex flex-col gap-6 py-6">
          <NotificationsClockContext value={clock}>
            <NotificationsList first={page} scope={ACCOUNT_INBOX} />
          </NotificationsClockContext>
        </LayoutContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
