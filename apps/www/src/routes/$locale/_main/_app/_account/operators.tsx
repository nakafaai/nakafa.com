import { createFileRoute } from "@tanstack/react-router";
import { IntlProvider, useMessages } from "use-intl";
import { createTranslator } from "use-intl/core";
import { OperatorConsole } from "@/components/operators/console";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";
import { createPrivateSeoHead, toRouterHead } from "@/lib/seo/head";

export const Route = createFileRoute("/$locale/_main/_app/_account/operators")({
  loader: async ({ params }) => {
    const messages = await readRenderedRouteMessages({
      locale: params.locale,
      namespaces: ["Operators", "SchoolStart"],
    });
    const t = createTranslator({
      locale: params.locale,
      messages,
      namespace: "Operators",
    });
    return {
      description: t("open-description"),
      messages,
      title: t("title"),
    };
  },
  head: ({ loaderData }) =>
    loaderData === undefined
      ? {}
      : toRouterHead(
          createPrivateSeoHead({
            description: loaderData.description,
            parts: [loaderData.title],
          })
        ),
  component: OperatorsPage,
});

/**
 * The console where Nakafa staff open a school under a contract. The route names no staff
 * link anywhere: an operator keeps its address, and the server refuses any other account.
 * Its words join the shell's messages, so only this page loads them.
 */
function OperatorsPage() {
  const { locale } = Route.useParams();
  const { messages } = Route.useLoaderData();
  const shell = useMessages();
  return (
    <IntlProvider locale={locale} messages={{ ...shell, ...messages }}>
      <LayoutMaterial>
        <LayoutMaterialContent>
          <OperatorConsole />
        </LayoutMaterialContent>
      </LayoutMaterial>
    </IntlProvider>
  );
}
