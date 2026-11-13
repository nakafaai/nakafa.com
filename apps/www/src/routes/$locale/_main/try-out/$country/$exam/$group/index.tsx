import { makeBreadcrumbNodes } from "@repo/seo/jsonld/node";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { TryoutGroupPageClient } from "@/components/tryout/catalog/group";
import { TryoutTrailHeader } from "@/components/tryout/catalog/trail";
import { readTryoutGroupFn } from "@/components/tryout/route/catalog.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutCatalogHeaders } from "@/components/tryout/route/headers";
import { readStaticData } from "@/lib/static/data";

/**
 * One group of an exam: a year of SNBT, a grade of TKA, or a Studienkolleg. Its
 * header's trail opens the other exams and groups, and its body holds the
 * group's tracks.
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
    // A group with one track is never a page, so even a link inside the app lands on its set table.
    if (route.kind === "entry") {
      throw redirect({
        href: `/${params.locale}/${route.entryPath}`,
        statusCode: 307,
      });
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
        <TryoutTrailHeader
          labels={route.labels}
          title={route.title}
          trail={route.trail}
        />
        <TryoutGroupPageClient locale={locale} page={route.page} />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
