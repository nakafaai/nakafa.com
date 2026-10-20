import { Nina } from "@repo/design-system/components/ui/nina";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createTranslator } from "use-intl";
import { EntryShellBody, EntryShellHeader } from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { SchoolStart } from "@/components/tenant/start/questionnaire";
import { readSchoolStartPageFn } from "@/lib/entry/page.fn";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/**
 * The page where anyone opens a Nakafa School by answering five questions. The
 * server sends a visitor to sign in first, and mounts the questionnaire with the
 * policy pages of its locale for a signed-in account.
 */
export const Route = createFileRoute("/$locale/_entry/school/new")({
  loader: async ({ params }) => {
    const [page, messages] = await Promise.all([
      readSchoolStartPageFn({ data: { locale: params.locale } }),
      readRouteMessages({
        data: { locale: params.locale, namespaces: ["SchoolStart"] },
      }),
    ]);
    if (page._tag === "Redirect") {
      throw redirect({ href: page.href, statusCode: 307 });
    }
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "SchoolStart",
    });
    return {
      description: t("metadata-description"),
      legal: page.legal,
      title: t("metadata-title"),
    };
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : toRouterHead(
          createSeoHead({
            canonicalPath: `/${params.locale}/school/new`,
            description: loaderData.description,
            image: getAppSocialArtwork({
              key: "home",
              locale: params.locale,
              publicPath: "",
            }),
            indexable: false,
            jsonLd: [],
            locale: params.locale,
            parts: [loaderData.title],
            type: "website",
          })
        ),
  component: SchoolNewPage,
});

/** The school questionnaire, framed as the learner questionnaire is. */
function SchoolNewPage() {
  const { legal } = Route.useLoaderData();
  return (
    <>
      <EntryShellHeader>
        <div className="ms-auto">
          <ThemePicker variant="ghost" />
        </div>
      </EntryShellHeader>
      <EntryShellBody>
        <SchoolStart legal={legal}>
          <Nina act="waving" label="" size={120} whole />
        </SchoolStart>
      </EntryShellBody>
    </>
  );
}
