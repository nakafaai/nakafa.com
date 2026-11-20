import { makeBreadcrumbNodes } from "@repo/seo/jsonld/node";
import { createFileRoute } from "@tanstack/react-router";
import { createTryoutHead } from "@/components/tryout/route/head";

/**
 * A track with no set open: its table alone, which the track's layout draws, and the
 * track's own head, taken from the layout's answer. A set's page has a head of its own,
 * so the track's stays here rather than on the layout, which every set page shares.
 */
export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$group/$track/"
)({
  loader: async ({ parentMatchPromise }) =>
    (await parentMatchPromise).loaderData?.head,
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : createTryoutHead({
          alternates: loaderData.alternates,
          canonicalPath: loaderData.canonicalPath,
          description: loaderData.description,
          image: loaderData.image,
          indexable: loaderData.indexable,
          jsonLd: makeBreadcrumbNodes(loaderData.breadcrumbs),
          locale: params.locale,
          title: loaderData.title,
        }),
});
