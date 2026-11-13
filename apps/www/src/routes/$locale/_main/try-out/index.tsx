import { makeBreadcrumbNodes } from "@repo/seo/jsonld/node";
import { createFileRoute } from "@tanstack/react-router";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { RefContent } from "@/components/shared/content/references";
import { PageBody } from "@/components/shared/page/body";
import { PageFooter } from "@/components/shared/page/footer";
import { Page } from "@/components/shared/page/frame";
import { TryoutHubClient } from "@/components/tryout/catalog/hub";
import { readTryoutHubFn } from "@/components/tryout/route/catalog.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutCatalogHeaders } from "@/components/tryout/route/headers";
import { HOME_TARGET } from "@/lib/routing/target";
import { readStaticData } from "@/lib/static/data";

/** The try-out hub: every exam family the catalog publishes, grouped by country. */
export const Route = createFileRoute("/$locale/_main/try-out/")({
  loader: ({ params }) =>
    readStaticData(readTryoutHubFn, { locale: params.locale }),
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : createTryoutHead({
          canonicalPath: `/${params.locale}/try-out`,
          description: loaderData.description,
          image: loaderData.image,
          indexable: true,
          jsonLd: makeBreadcrumbNodes(loaderData.breadcrumbs),
          locale: params.locale,
          title: loaderData.title,
        }),
  headers: readTryoutCatalogHeaders,
  component: TryoutHubPage,
});

function TryoutHubPage() {
  const { labels, page } = Route.useLoaderData();
  return (
    <Page>
      <BreadcrumbHeader
        value={{
          home: HOME_TARGET,
          homeLabel: labels.home,
          items: [{ label: labels.tryOut }],
          title: labels.tryOut,
        }}
      />
      <PageBody>
        <TryoutHubClient page={page} />
      </PageBody>
      <PageFooter>
        <RefContent />
      </PageFooter>
    </Page>
  );
}
