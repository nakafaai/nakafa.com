import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { NotificationsClockContext } from "@/components/notifications/clock";
import { NotificationsHeader } from "@/components/notifications/header";
import { NotificationsList } from "@/components/notifications/list";
import { LayoutContent } from "@/components/shared/content/layout";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { useAgeClock } from "@/components/user/clock.client";
import { signedInHead } from "@/lib/account/head";
import { notificationsScreenFn } from "@/lib/account/home.fn";

export const Route = createFileRoute("/$locale/_app/_account/notifications")({
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
        <NotificationsHeader first={page} />
        <LayoutContent className="flex flex-col gap-6 py-6">
          <NotificationsClockContext value={clock}>
            <NotificationsList first={page} />
          </NotificationsClockContext>
        </LayoutContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
