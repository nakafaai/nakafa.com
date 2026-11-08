import { makeBreadcrumbNodes } from "@repo/seo/json-ld/node";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { TryoutCatalogChoices } from "@/components/tryout/catalog/choice";
import { TryoutGroupPageClient } from "@/components/tryout/catalog/group";
import {
  TryoutExamSelector,
  TryoutGroupSelector,
} from "@/components/tryout/catalog/selector";
import { readTryoutGroupFn } from "@/components/tryout/route/catalog.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutCatalogHeaders } from "@/components/tryout/route/headers";
import { getTryoutCrumbTarget } from "@/components/tryout/route/path";
import { HOME_TARGET } from "@/lib/routing/target";
import { readStaticData } from "@/lib/static/data";

/**
 * One group of an exam: a year of SNBT, a grade of TKA, or a Studienkolleg. Its
 * header picks the exam and the group, and its body holds the group's tracks.
 */
export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$group/"
)({
  loader: async ({ params }) => {
    const route = await readStaticData(readTryoutGroupFn, {
      country: params.country,
      exam: params.exam,
      group: params.group,
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
  component: TryoutGroupPage,
});

function TryoutGroupPage() {
  const { locale } = Route.useParams();
  const route = Route.useLoaderData();
  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <BreadcrumbHeader
          value={{
            action: (
              <TryoutCatalogChoices>
                <TryoutExamSelector
                  currentValue={route.page.exam.publicPath}
                  options={route.examOptions}
                />
                <TryoutGroupSelector
                  axis={route.page.exam.groupAxis}
                  currentValue={route.page.group.publicPath}
                  options={route.groupOptions}
                />
              </TryoutCatalogChoices>
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
              { label: route.name },
            ],
            title: route.name,
          }}
        />
        <TryoutGroupPageClient locale={locale} page={route.page} />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
