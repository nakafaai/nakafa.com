import { createFileRoute, notFound } from "@tanstack/react-router";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { TryoutExamPageClient } from "@/components/tryout/catalog/exam";
import { TryoutExamSelector } from "@/components/tryout/catalog/selector";
import { readTryoutExamFn } from "@/components/tryout/route/catalog.fn";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutCatalogHeaders } from "@/components/tryout/route/headers";

/** One exam of the try-out catalog: its tracks, each a year or a series. */
export const Route = createFileRoute("/$locale/_main/try-out/$country/$exam/")({
  loader: async ({ params }) => {
    const route = await readTryoutExamFn({
      data: {
        country: params.country,
        exam: params.exam,
        locale: params.locale,
      },
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
  component: TryoutExamPage,
});

function TryoutExamPage() {
  const { locale } = Route.useParams();
  const route = Route.useLoaderData();
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <BreadcrumbHeader
          value={{
            action: (
              <TryoutExamSelector
                currentValue={route.examPath}
                label={route.selectorLabel}
                options={route.examOptions}
              />
            ),
            homeHref: "/home",
            homeLabel: route.labels.home,
            items: [
              {
                href: route.countryHref,
                label: route.labels.tryOut,
                menuLabel: route.labels.tryOutShort,
              },
              { label: route.exam.exam.title },
            ],
            menuLabel: route.labels.more,
            title: route.exam.exam.title,
          }}
        />
        <TryoutExamPageClient locale={locale} page={route.exam} />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
