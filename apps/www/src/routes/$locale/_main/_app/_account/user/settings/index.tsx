import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Effect, Match } from "effect";
import { UserSettingsAgents } from "@/components/user/settings/agents";
import { UserSettingsProfilePage } from "@/components/user/settings/profile";
import { UserSettingsPage } from "@/components/user/settings/section";
import { privateHead } from "@/lib/account/head";

export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings/"
)({
  loader: async ({ params }) => {
    const { readSettingsScreen } = await import("@/lib/account/settings");
    const outcome = await Effect.runPromise(
      readSettingsScreen(params.locale, window.location.origin)
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
  component: SettingsPage,
});

function SettingsPage() {
  const { account } = Route.useLoaderData();
  return (
    <UserSettingsPage>
      <UserSettingsProfilePage initialAccount={account}>
        <UserSettingsAgents />
      </UserSettingsProfilePage>
    </UserSettingsPage>
  );
}
