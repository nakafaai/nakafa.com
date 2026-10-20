import { createFileRoute } from "@tanstack/react-router";
import { NotificationsFeed } from "@/components/notifications/feed";
import { NotificationsHeader } from "@/components/notifications/header";
import { NotificationsProvider } from "@/components/notifications/provider";
import { LayoutContent } from "@/components/shared/content/layout";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { signedInHead } from "@/lib/account/head";
import { notificationsScreenFn } from "@/lib/account/home.fn";

export const Route = createFileRoute("/$locale/_app/_account/notifications")({
  loader: ({ params }) =>
    notificationsScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : signedInHead(loaderData.seo),
  component: NotificationsPage,
});

/** The inbox of the signed-in account, in the app shell. */
function NotificationsPage() {
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <NotificationsProvider>
          <NotificationsHeader />
          <LayoutContent className="flex flex-col gap-6 py-6">
            <NotificationsFeed />
          </LayoutContent>
        </NotificationsProvider>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
