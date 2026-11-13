import { makeBreadcrumbNodes } from "@repo/seo/jsonld/node";
import {
  createFileRoute,
  notFound,
  stripSearchParams,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import {
  CATALOG_QUERY_DEFAULTS,
  CatalogQuery,
  catalogLoaderDeps,
} from "@/components/tryout/catalog/table/query";
import { TryoutSetTable } from "@/components/tryout/catalog/table/sets";
import { TryoutTrailHeader } from "@/components/tryout/catalog/trail";
import { readTryoutTrackFn } from "@/components/tryout/route/catalog.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { hasSignedInHint } from "@/lib/auth/hint";
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
 * One track of the try-out catalog: its heading, its exam and group selectors and
 * its set list, read in one answer, so the page shows whole. The build prerenders that
 * answer and every reader gets it; a signed-in learner's table replaces its rows
 * with their own, read from Convex in the browser.
 */
export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$group/$track/"
)({
  validateSearch: Schema.toStandardSchemaV1(CatalogQuery),
  search: { middlewares: [stripSearchParams(CATALOG_QUERY_DEFAULTS)] },
  loaderDeps: ({ search }) => catalogLoaderDeps(search),
  loader: async ({ deps, params }) => {
    const route = await readStaticData(readTryoutTrackFn, {
      country: params.country,
      exam: params.exam,
      group: params.group,
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
          jsonLd: makeBreadcrumbNodes(loaderData.head.breadcrumbs),
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
        <TryoutTrailHeader
          labels={route.labels}
          title={route.page.track.title}
          trail={route.trail}
        />
        <TryoutSetTable
          bootstrap={route.list}
          key={`${locale}:${route.page.track.publicPath}`}
        />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
