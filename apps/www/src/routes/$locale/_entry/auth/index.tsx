import { Nina } from "@repo/design-system/components/ui/nina";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import { useTranslations } from "use-intl";
import { createTranslator } from "use-intl/core";
import { Auth } from "@/components/auth";
import { SignInScreen } from "@/components/auth/screen";
import { EntryShellHeader } from "@/components/entry/shell";
import { BackButton } from "@/components/shared/back";
import { ThemePicker } from "@/components/shared/theme/picker";
import {
  getPostAuthDestination,
  resolvePostAuthIntent,
} from "@/lib/auth/admission";
import { isSignedIn } from "@/lib/auth/gate";
import { readAuthLegalFn } from "@/lib/auth/legal.functions";
import { TextSearchParam } from "@/lib/entry/search";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { readStaticData } from "@/lib/static/data";

/** The sign-in screen. A provider failure and the intent travel in the query string. */
const AuthSearch = Schema.Struct({
  error: TextSearchParam,
  redirect: TextSearchParam,
});

/**
 * The sign-in page takes the root metadata, which names its title, description
 * and the canonical address of the locale's home, as the reference app does. A
 * signed-in visitor never sees it: the gate sends them on to the page the intent
 * names, or home, before the loader runs, with 307 on the server. The build
 * prerenders the page for visitors, so its loader reads the static answers.
 */
export const Route = createFileRoute("/$locale/_entry/auth/")({
  validateSearch: Schema.toStandardSchemaV1(AuthSearch),
  beforeLoad: async ({ params, search }) => {
    if (!(await isSignedIn())) {
      return;
    }
    const destination = getPostAuthDestination(
      resolvePostAuthIntent(search.redirect, params.locale),
      params.locale
    );
    // The intent is a validated path of any page, so it stays an href, not a typed route.
    throw redirect({
      href: `/${destination.locale}${destination.href}`,
      statusCode: 307,
    });
  },
  loader: async ({ params }) => {
    const [messages, legal] = await Promise.all([
      readStaticData(readRouteMessages, {
        locale: params.locale,
        namespaces: ["Metadata"],
      }),
      readStaticData(readAuthLegalFn, { locale: params.locale }),
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
