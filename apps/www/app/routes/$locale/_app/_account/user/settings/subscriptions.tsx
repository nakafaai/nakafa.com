import { createFileRoute } from "@tanstack/react-router";
import { UserSettingsSubscriptions } from "@/components/user/settings/subscriptions";
import { signedInHead } from "@/lib/account/head";
import { subscriptionsScreenFn } from "@/lib/account/settings.fn";

export const Route = createFileRoute(
  "/$locale/_app/_account/user/settings/subscriptions"
)({
  loader: ({ params }) =>
    subscriptionsScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) => loaderData && signedInHead(loaderData.seo),
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const { subscription } = Route.useLoaderData();
  return <UserSettingsSubscriptions initialSubscription={subscription} />;
}
