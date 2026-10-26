import { makeBreadcrumbNodes } from "@repo/seo/json-ld/node";
import { createFileRoute } from "@tanstack/react-router";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/frame";
import { RefContent } from "@/components/shared/content/references";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
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
          title: loaderData.labels.tryOut,
        }),
  headers: readTryoutCatalogHeaders,
  component: TryoutHubPage,
});

function TryoutHubPage() {
  const { labels, page, sourceUrl } = Route.useLoaderData();
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <BreadcrumbHeader
          value={{
            home: HOME_TARGET,
            homeLabel: labels.home,
            items: [{ label: labels.tryOut }],
            menuLabel: labels.more,
            title: labels.tryOut,
          }}
        />
        <LayoutContent>
          <TryoutHubClient page={page} />
        </LayoutContent>
        <FooterContent>
          <RefContent githubUrl={sourceUrl} />
        </FooterContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
