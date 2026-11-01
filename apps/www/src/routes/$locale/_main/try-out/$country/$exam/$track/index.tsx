import {
  createFileRoute,
  notFound,
  stripSearchParams,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Option, Schema } from "effect";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { TryoutExamSelector } from "@/components/tryout/catalog/selector";
import {
  CATALOG_QUERY_DEFAULTS,
  CatalogQuery,
  catalogLoaderDeps,
} from "@/components/tryout/catalog/table/query";
import { TryoutSetTable } from "@/components/tryout/catalog/table/table";
import { readTryoutTrackFn } from "@/components/tryout/route/catalog.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { getTryoutCrumbTarget } from "@/components/tryout/route/path";
import { hasSignedInHint } from "@/lib/auth/hint";
import { HOME_TARGET } from "@/lib/routing/target";
import { readStaticData } from "@/lib/static/data";

/**
 * The catalog query that a loader reads. A learner's table reads its own selection
 * live (`useTryoutSetData`), so their move between filters reads the answer the
 * build kept and asks no Worker.
 */
const readLoaderQuery = createIsomorphicFn()
  .server((query: CatalogQuery) => query)
  .client((query: CatalogQuery) =>
    hasSignedInHint(document.cookie)
      ? catalogLoaderDeps(CATALOG_QUERY_DEFAULTS)
      : query
  );

/**
 * One track of the try-out catalog: its heading, its exam selector and its set
 * list, read in one answer, so the page shows whole. The build prerenders that
 * answer and every reader gets it; a signed-in learner's table replaces its rows
 * with their own, read from Convex in the browser.
 */
export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$track/"
)({
  validateSearch: Schema.toStandardSchemaV1(CatalogQuery),
  search: { middlewares: [stripSearchParams(CATALOG_QUERY_DEFAULTS)] },
  loaderDeps: ({ search }) => catalogLoaderDeps(search),
  loader: async ({ deps, params }) => {
    const route = await readStaticData(readTryoutTrackFn, {
      country: params.country,
      exam: params.exam,
      locale: params.locale,
      search: readLoaderQuery(deps),
      track: params.track,
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
          indexable: loaderData.head.indexable,
          jsonLd: [],
          locale: params.locale,
          title: loaderData.head.title,
        }),
  component: TryoutTrackPage,
});

function TryoutTrackPage() {
  const { locale } = Route.useParams();
  const route = Route.useLoaderData();
  return (
    <LayoutMaterial className="h-[calc(100svh-4rem)] flex-col overflow-clip lg:h-svh">
      <LayoutMaterialContent className="flex min-h-0 flex-1 flex-col">
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
              {
                label: route.page.exam.title,
                target: Option.getOrUndefined(
                  getTryoutCrumbTarget(route.examPath)
                ),
              },
              { label: route.page.track.title },
            ],
            title: route.page.track.title,
          }}
        />
        <TryoutSetTable
          bootstrap={route.list}
          key={`${locale}:${route.page.track.publicPath}`}
          title={route.page.track.title}
        />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
