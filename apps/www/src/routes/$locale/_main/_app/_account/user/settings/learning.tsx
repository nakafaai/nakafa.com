import { createFileRoute } from "@tanstack/react-router";
import { UserSettingsCurriculum } from "@/components/user/settings/curriculum";
import { UserSettingsLearningPage } from "@/components/user/settings/learning";
import { privateHead } from "@/lib/account/head";
import { learningScreenFn } from "@/lib/account/settings.functions";

export const Route = createFileRoute(
  "/$locale/_main/_app/_account/user/settings/learning"
)({
  loader: ({ params }) => learningScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) =>
    loaderData === undefined ? {} : privateHead(loaderData.seo),
  component: LearningPage,
});

function LearningPage() {
  const { account, preference, programs } = Route.useLoaderData();
  const { locale } = Route.useParams();
  return (
    <UserSettingsLearningPage initialAccount={account}>
      <UserSettingsCurriculum
        initialPreference={preference}
        initialPrograms={programs}
        locale={locale}
      />
    </UserSettingsLearningPage>
  );
}
