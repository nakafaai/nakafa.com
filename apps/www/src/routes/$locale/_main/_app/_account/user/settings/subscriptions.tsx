import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Effect, Match } from "effect";
import { UserSettingsPage } from "@/components/user/settings/section";
import { UserSettingsSubscriptions } from "@/components/user/settings/subscriptions";
import { privateHead } from "@/lib/account/head";

export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings/subscriptions"
)({
  loader: async ({ params }) => {
    const { readSubscriptionsScreen } = await import("@/lib/account/settings");
    const outcome = await Effect.runPromise(
      readSubscriptionsScreen(params.locale)
    );
    return Match.value(outcome).pipe(
      Match.tagsExhaustive({
        NotFound: () => {
          throw notFound();
        },
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
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const { overview } = Route.useLoaderData();
  return (
    <UserSettingsPage>
      <UserSettingsSubscriptions initialOverview={overview} />
    </UserSettingsPage>
  );
}
