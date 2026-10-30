import { captureException } from "@repo/analytics/posthog/capture";
import { Nina } from "@repo/design-system/components/ui/nina";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import { useEffect } from "react";
import { createTranslator } from "use-intl/core";
import { AuthLegal } from "@/components/auth/legal";
import { EntryShellBody, EntryShellHeader } from "@/components/entry/shell";
import { OnboardingQuestionnaire } from "@/components/programs/onboarding/questionnaire";
import { ThemePicker } from "@/components/shared/theme/picker";
import { readAuthLegalFn } from "@/lib/auth/legal.functions";
import {
  admitOnboardingFn,
  readOnboardingPageFn,
} from "@/lib/entry/page.functions";
import { TextSearchParam } from "@/lib/entry/search";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";
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
    const [page, messages, legal] = await Promise.all([
      readOnboardingPageFn({
        data: { intent: deps.intent, locale: params.locale },
      }),
      readRenderedRouteMessages({
        locale: params.locale,
        namespaces: ["LearningPrograms", "Metadata"],
      }),
      readAuthLegalFn({ data: { locale: params.locale } }),
    ]);
    if (page._tag === "Redirect") {
      // The destination is the server's decision, so it stays an href, not a typed route.
      throw redirect({ href: page.href, statusCode: 307 });
    }
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "LearningPrograms",
    });
    const metadata = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Metadata",
    });
    return {
      description: t("metadata-description"),
      intent: page.intent,
      legal,
      profile: page.profile,
      title: `${t("metadata-title")} - ${metadata("title")}`,
    };
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : toRouterHead(
          createSeoHead({
            absoluteTitle: loaderData.title,
            canonicalPath: `/${params.locale}`,
            description: loaderData.description,
            image: getAppSocialArtwork({
              key: "home",
              locale: params.locale,
              publicPath: "",
            }),
            indexable: true,
            jsonLd: [],
            locale: params.locale,
            parts: [],
            type: "website",
          })
        ),
  component: OnboardingPage,
});

/**
 * The questionnaire of the account, with the legal links of the sign-up. The
 * admission is recorded once the questionnaire mounts, never by the page read.
 */
function OnboardingPage() {
  const { intent, legal, profile } = Route.useLoaderData();
  useEffect(() => {
    admitOnboardingFn().catch((error: unknown) => {
      captureException(error, { source: "start-onboarding-admission" });
    });
  }, []);
  return (
    <>
      <EntryShellHeader>
        <div className="ms-auto">
          <ThemePicker variant="ghost" />
        </div>
      </EntryShellHeader>
      <EntryShellBody>
        {/* Each question's choices stand in one list, so on a screen shorter
            than the longest question with Nina, Nina steps aside and the
            question stays whole without scrolling. */}
        <div className="[@media(max-height:50rem)]:hidden">
          <Nina act="writing" label="" size={88} whole />
        </div>
        <OnboardingQuestionnaire initialProfile={profile} intent={intent} />
        <AuthLegal links={legal} />
      </EntryShellBody>
    </>
  );
}
