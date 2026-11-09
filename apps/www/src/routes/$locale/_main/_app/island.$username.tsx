import { createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { useTranslations } from "use-intl";
import { IslandFrame } from "@/components/island/frame";
import { IslandHeader } from "@/components/island/header";
import { PageStack } from "@/components/shared/page/body";
import { Page } from "@/components/shared/page/frame";
import { signedInHead } from "@/lib/account/head";
import { islandVisitFn } from "@/lib/account/home.functions";
import { IslandContext } from "@/lib/island/context";

export const Route = createFileRoute("/$locale/_main/_app/island/$username")({
  loader: ({ params }) =>
    islandVisitFn({
      data: { locale: params.locale, username: params.username },
    }),
  head: ({ loaderData }) =>
    loaderData === undefined
      ? {}
      : signedInHead(loaderData.seo, loaderData.island.snapshot),
  component: VisitPage,
});

/**
 * A visit to a learner's shared island (ADR 0042, D20): the island as the
 * server read it, read only, at the owner's hour. A visitor can turn it, see
 * it full screen and hear it; nothing they do changes it, so the page opens no
 * live query.
 */
function VisitPage() {
  const t = useTranslations("Island");
  const { island } = Route.useLoaderData();
  return (
    <IslandContext
      value={{
        badges: island.badges.length,
        layout: island.layout,
        level: island.level,
        owner: Option.none(),
        size: island.size,
        timeZone: island.timeZone,
      }}
    >
      <Page width="page">
        <IslandHeader title={t("name", { name: island.name })} />
        <PageStack>
          <IslandFrame name={island.name} />
        </PageStack>
      </Page>
    </IslandContext>
  );
}
