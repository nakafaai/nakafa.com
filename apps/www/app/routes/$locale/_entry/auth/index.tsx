import { Nina } from "@repo/design-system/components/ui/nina";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { createTranslator, useTranslations } from "use-intl";
import { Auth } from "@/components/auth";
import { SignInScreen } from "@/components/auth/screen";
import { EntryShellHeader } from "@/components/entry/shell";
import { BackButton } from "@/components/shared/back";
import { ThemePicker } from "@/components/shared/theme/picker";
import { readAuthLegalFn } from "@/lib/auth/legal.fn";
import { TextSearchParam } from "@/lib/entry/search";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/** The sign-in screen. A provider failure and the intent travel in the query string. */
const AuthSearch = Schema.Struct({
  error: TextSearchParam,
  redirect: TextSearchParam,
});

/** The sign-in page takes the root metadata, which names its title and description. */
export const Route = createFileRoute("/$locale/_entry/auth/")({
  validateSearch: Schema.toStandardSchemaV1(AuthSearch),
  loader: async ({ params }) => {
    const [messages, legal] = await Promise.all([
      readRouteMessages({
        data: { locale: params.locale, namespaces: ["Metadata"] },
      }),
      readAuthLegalFn({ data: { locale: params.locale } }),
    ]);
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Metadata",
    });
    return { description: t("description"), legal, title: t("title") };
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : toRouterHead(
          createSeoHead({
            canonicalPath: `/${params.locale}/auth`,
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
  component: AuthPage,
});

/** The sign-in page: the back button, the theme, the title and the sign-in actions. */
function AuthPage() {
  const t = useTranslations("Auth");
  const { legal } = Route.useLoaderData();
  return (
    <>
      <EntryShellHeader>
        <BackButton />
        <ThemePicker variant="ghost" />
      </EntryShellHeader>
      <SignInScreen
        action={<Auth />}
        figure={
          <Nina
            act="relaxed"
            fidget={["waving"]}
            label=""
            mood="hello"
            size={190}
            whole
          />
        }
        legal={legal}
      >
        <h1 className="font-semibold text-2xl">{t("sign-in-title")}</h1>
      </SignInScreen>
    </>
  );
}
