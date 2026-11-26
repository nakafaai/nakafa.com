import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Match, Option, Schema } from "effect";
import { AccountPreferences } from "@/components/notifications/account";
import { NotificationsClockContext } from "@/components/notifications/clock";
import { NotificationsHeader } from "@/components/notifications/header";
import { ACCOUNT_INBOX } from "@/components/notifications/inbox";
import { NotificationsList } from "@/components/notifications/list";
import { MarkAllRead } from "@/components/notifications/read";
import { InboxTabs } from "@/components/notifications/tabs";
import {
  InboxAddressTopic,
  InboxTopic,
} from "@/components/notifications/topic";
import { PageStack } from "@/components/shared/page/body";
import { Page } from "@/components/shared/page/frame";
import { useAgeClock } from "@/components/user/ages";
import { privateHead } from "@/lib/account/head";

/** The tab the address names, All without one. */
const NotificationsSearch = Schema.Struct({
  topic: Schema.optionalKey(InboxAddressTopic),
});

export const Route = createFileRoute(
  "/$locale/_main/_app/_account/notifications"
)({
  validateSearch: Schema.toStandardSchemaV1(NotificationsSearch),
  loader: async ({ params }) => {
    const { readNotificationsScreen } = await import(
      "@/lib/account/notifications"
    );
    const outcome = await Effect.runPromise(
      readNotificationsScreen(params.locale, window.location.origin)
    );
    return Match.value(outcome).pipe(
      Match.tagsExhaustive({
        Ready: ({ screen }) => screen,
        SignedOut: () => {
          throw redirect({
            params: { locale: params.locale },
            statusCode: 307,
            to: "/$locale/auth",
          });
        },
      })
    );
  },
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : privateHead(loaderData.seo),
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
    <Page>
      <NotificationsHeader>
        <ButtonGroup>
          <MarkAllRead scope={ACCOUNT_INBOX} />
          <AccountPreferences />
        </ButtonGroup>
      </NotificationsHeader>
      <InboxTabs topics={InboxTopic.literals} />
      <PageStack>
        <NotificationsClockContext value={clock}>
          <NotificationsList first={page} scope={ACCOUNT_INBOX} />
        </NotificationsClockContext>
      </PageStack>
    </Page>
  );
}
