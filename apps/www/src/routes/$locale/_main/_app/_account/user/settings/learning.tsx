import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Effect, Match } from "effect";
import { UserSettingsCurriculum } from "@/components/user/settings/curriculum";
import { UserSettingsLearningPage } from "@/components/user/settings/learning";
import { UserSettingsPage } from "@/components/user/settings/section";
import { privateHead } from "@/lib/account/head";

export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings/learning"
)({
  loader: async ({ params }) => {
    const { readLearningScreen } = await import("@/lib/account/settings");
    const outcome = await Effect.runPromise(readLearningScreen(params.locale));
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
  component: LearningPage,
});

function LearningPage() {
  const { account, preference, programs } = Route.useLoaderData();
  const { locale } = Route.useParams();
  return (
    <UserSettingsPage>
      <UserSettingsLearningPage initialAccount={account}>
        <UserSettingsCurriculum
          initialPreference={preference}
          initialPrograms={programs}
          locale={locale}
        />
      </UserSettingsLearningPage>
    </UserSettingsPage>
  );
}
