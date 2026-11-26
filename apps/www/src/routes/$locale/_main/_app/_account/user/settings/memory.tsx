import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Effect, Match } from "effect";
import { UserSettingsMemory } from "@/components/user/settings/memory/view";
import { UserSettingsPage } from "@/components/user/settings/section";
import { privateHead } from "@/lib/account/head";

export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings/memory"
)({
  loader: async ({ params }) => {
    const { readMemoryScreen } = await import("@/lib/account/settings");
    const outcome = await Effect.runPromise(readMemoryScreen(params.locale));
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
  component: MemoryPage,
});

function MemoryPage() {
  const { first, now, paused } = Route.useLoaderData();
  return (
    <UserSettingsPage>
      <UserSettingsMemory first={first} now={now} paused={paused} />
    </UserSettingsPage>
  );
}
