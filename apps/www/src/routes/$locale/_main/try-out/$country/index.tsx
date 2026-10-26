import { createFileRoute, notFound } from "@tanstack/react-router";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/frame";
import { RefContent } from "@/components/shared/content/references";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { TryoutCountryPageClient } from "@/components/tryout/catalog/country";
import { TryoutCountrySelector } from "@/components/tryout/catalog/selector";
import { readTryoutCountryFn } from "@/components/tryout/route/catalog.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutCatalogHeaders } from "@/components/tryout/route/headers";
import { HOME_TARGET } from "@/lib/routing/target";
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
          canonicalPath: loaderData.head.canonicalPath,
          description: loaderData.head.description,
          image: loaderData.head.image,
          indexable: true,
          jsonLd: [],
          locale: params.locale,
          title: loaderData.head.title,
        }),
  headers: readTryoutCatalogHeaders,
  component: TryoutCountryPage,
});

function TryoutCountryPage() {
  const route = Route.useLoaderData();
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <BreadcrumbHeader
          value={{
            action:
              route.countryOptions.length > 0 ? (
                <TryoutCountrySelector
                  currentValue={route.countryPath}
                  label={route.selectorLabel}
                  options={route.countryOptions}
                />
              ) : undefined,
            home: HOME_TARGET,
            homeLabel: route.labels.home,
            items: [{ label: route.labels.tryOut }],
            title: route.labels.tryOut,
          }}
        />
        <LayoutContent>
          <TryoutCountryPageClient page={{ exams: route.exams }} />
        </LayoutContent>
        <FooterContent>
          <RefContent githubUrl={route.sourceUrl} />
        </FooterContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
