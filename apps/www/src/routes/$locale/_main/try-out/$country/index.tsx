import { makeBreadcrumbNodes } from "@repo/seo/jsonld/node";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { RefContent } from "@/components/shared/content/references";
import { PageBody } from "@/components/shared/page/body";
import { PageFooter } from "@/components/shared/page/footer";
import { Page } from "@/components/shared/page/frame";
import { TryoutCountryOthers } from "@/components/tryout/catalog/countries";
import { TryoutCountryPageClient } from "@/components/tryout/catalog/country";
import { TryoutTrailHeader } from "@/components/tryout/catalog/trail";
import { readTryoutCountryFn } from "@/components/tryout/route/catalog.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutCatalogHeaders } from "@/components/tryout/route/headers";
import { readStaticData } from "@/lib/static/data";

/** One country of the try-out catalog: its exam families. */
export const Route = createFileRoute("/$locale/_main/try-out/$country/")({
  loader: async ({ params }) => {
    const route = await readStaticData(readTryoutCountryFn, {
      country: params.country,
      locale: params.locale,
    });
    if (route.kind === "notFound") {
      throw notFound();
    }
    return route;
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : createTryoutHead({
          alternates: loaderData.head.alternates,
          canonicalPath: loaderData.head.canonicalPath,
          description: loaderData.head.description,
          image: loaderData.head.image,
          indexable: true,
          jsonLd: makeBreadcrumbNodes(loaderData.head.breadcrumbs),
          locale: params.locale,
          title: loaderData.head.title,
        }),
  headers: readTryoutCatalogHeaders,
  component: TryoutCountryPage,
});

function TryoutCountryPage() {
  const route = Route.useLoaderData();
  return (
    <Page>
      <TryoutTrailHeader
        labels={route.labels}
        title={route.title}
        trail={route.trail}
      />
      <PageBody>
        <TryoutCountryPageClient page={{ exams: route.exams }}>
          <TryoutCountryOthers />
        </TryoutCountryPageClient>
      </PageBody>
      <PageFooter>
        <RefContent />
      </PageFooter>
    </Page>
  );
}
