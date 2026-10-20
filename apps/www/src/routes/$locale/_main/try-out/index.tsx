import { makeBreadcrumbNodes } from "@repo/seo/json-ld/node";
import { createFileRoute } from "@tanstack/react-router";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/layout";
import { RefContent } from "@/components/shared/content/references";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { TryoutHubClient } from "@/components/tryout/catalog/hub";
import { readTryoutHubFn } from "@/components/tryout/route/catalog.fn";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutCatalogHeaders } from "@/components/tryout/route/headers";

/** The try-out hub: every exam family the catalog publishes, grouped by country. */
export const Route = createFileRoute("/$locale/_main/try-out/")({
  loader: ({ params }) => readTryoutHubFn({ data: { locale: params.locale } }),
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
  const { locale } = Route.useParams();
  const { labels, page, sourceUrl } = Route.useLoaderData();
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <BreadcrumbHeader
          value={{
            homeHref: "/home",
            homeLabel: labels.home,
            items: [{ label: labels.tryOut }],
            menuLabel: labels.more,
            title: labels.tryOut,
          }}
        />
        <LayoutContent>
          <TryoutHubClient locale={locale} page={page} />
        </LayoutContent>
        <FooterContent>
          <RefContent githubUrl={sourceUrl} />
        </FooterContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
