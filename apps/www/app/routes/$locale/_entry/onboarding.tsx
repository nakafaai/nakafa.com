import { Nina } from "@repo/design-system/components/ui/nina";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import { createTranslator } from "use-intl";
import { AuthLegal } from "@/components/auth/legal";
import { EntryShellBody, EntryShellHeader } from "@/components/entry/shell";
import { OnboardingQuestionnaire } from "@/components/programs/onboarding/questionnaire";
import { ThemePicker } from "@/components/shared/theme/picker";
import { readOnboardingPageFn } from "@/lib/entry/page.fn";
import { TextSearchParam } from "@/lib/entry/search";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/** The intent that the sign-in resumes after the questionnaire. */
const OnboardingSearch = Schema.Struct({
  intent: TextSearchParam,
});

/**
 * The first-run questionnaire of a signed-in account. The server decides first:
 * a visitor, or an account that is done, is redirected before the stream, so
 * the page never shows the questionnaire to someone who must leave it.
 */
export const Route = createFileRoute("/$locale/_entry/onboarding")({
  validateSearch: Schema.toStandardSchemaV1(OnboardingSearch),
  loaderDeps: ({ search }) => ({ intent: search.intent }),
  loader: async ({ deps, params }) => {
    const [page, messages] = await Promise.all([
      readOnboardingPageFn({
        data: { intent: deps.intent, locale: params.locale },
      }),
      readRouteMessages({
        data: { locale: params.locale, namespaces: ["LearningPrograms"] },
      }),
    ]);
    if (page._tag === "Redirect") {
      throw redirect({ href: page.href, statusCode: 307 });
    }
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "LearningPrograms",
    });
    return {
      description: t("metadata-description"),
      intent: page.intent,
      profile: page.profile,
      title: t("metadata-title"),
    };
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : toRouterHead(
          createSeoHead({
            canonicalPath: `/${params.locale}/onboarding`,
            description: loaderData.description,
            image: getAppSocialArtwork({
              key: "home",
              locale: params.locale,
              publicPath: "",
            }),
            indexable: true,
            jsonLd: [],
            locale: params.locale,
            parts: [loaderData.title],
            type: "website",
          })
        ),
  component: OnboardingPage,
});

/** The questionnaire of the account, with the legal links of the sign-up. */
function OnboardingPage() {
  const { intent, profile } = Route.useLoaderData();
  return (
    <>
      <EntryShellHeader>
        <div className="ms-auto">
          <ThemePicker variant="ghost" />
        </div>
      </EntryShellHeader>
      <EntryShellBody>
        <Nina act="writing" label="" size={120} whole />
        <OnboardingQuestionnaire initialProfile={profile} intent={intent} />
        <AuthLegal />
      </EntryShellBody>
    </>
  );
}
