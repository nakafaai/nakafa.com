import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { TryoutExamPageClient } from "@/components/tryout/catalog/exam";
import { TryoutExamSelector } from "@/components/tryout/catalog/selector";
import { readTryoutExamFn } from "@/components/tryout/route/catalog.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutCatalogHeaders } from "@/components/tryout/route/headers";
import { getTryoutCrumbTarget } from "@/components/tryout/route/path";
import { HOME_TARGET } from "@/lib/routing/target";

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
            home: HOME_TARGET,
            homeLabel: route.labels.home,
            items: [
              {
                label: route.labels.tryOut,
                menuLabel: route.labels.tryOutShort,
                target: Option.getOrUndefined(
                  getTryoutCrumbTarget(route.countryPath)
                ),
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
