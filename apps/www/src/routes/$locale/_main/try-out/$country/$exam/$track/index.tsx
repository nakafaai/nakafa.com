import {
  Await,
  createFileRoute,
  defer,
  notFound,
} from "@tanstack/react-router";
import { Schema } from "effect";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
import { TryoutExamSelector } from "@/components/tryout/catalog/selector";
import { TryoutSetTable } from "@/components/tryout/catalog/table/table";
import {
  readTryoutTrackFn,
  readTryoutTrackListFn,
  type TryoutTrackListResult,
} from "@/components/tryout/route/catalog.functions";
import { createTryoutHead } from "@/components/tryout/route/head";
import { readTryoutPersonalHeaders } from "@/components/tryout/route/headers";
import { TryoutTrackSearch } from "@/components/tryout/route/search";

/**
 * One track of the try-out catalog: its heading and exam selector come first,
 * and the learner's own set list streams in below them.
 */
export const Route = createFileRoute(
  "/$locale/_main/try-out/$country/$exam/$track/"
)({
  validateSearch: Schema.toStandardSchemaV1(TryoutTrackSearch),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const route = await readTryoutTrackFn({
      data: {
        country: params.country,
        exam: params.exam,
        locale: params.locale,
        track: params.track,
      },
    });
    if (route.kind === "notFound") {
      throw notFound();
    }
    return {
      ...route,
      list: defer(
        readTryoutTrackListFn({
          data: {
            locale: params.locale,
            search: deps,
            track: {
              countryKey: route.page.country.countryKey,
              examKey: route.page.exam.examKey,
              trackKey: route.page.track.trackKey,
            },
          },
        })
      ),
    };
  },
  head: ({ loaderData, params }) =>
    loaderData === undefined
      ? {}
      : createTryoutHead({
          canonicalPath: loaderData.head.canonicalPath,
          description: loaderData.head.description,
          image: loaderData.head.image,
          indexable: loaderData.head.indexable,
          jsonLd: [],
          locale: params.locale,
          title: loaderData.head.title,
        }),
  headers: readTryoutPersonalHeaders,
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
            homeHref: "/home",
            homeLabel: route.labels.home,
            items: [
              {
                href: route.countryHref,
                label: route.labels.tryOut,
                menuLabel: route.labels.tryOutShort,
              },
              { href: route.examHref, label: route.page.exam.title },
              { label: route.page.track.title },
            ],
            menuLabel: route.labels.more,
            title: route.page.track.title,
          }}
        />
        <Await<TryoutTrackListResult> fallback={null} promise={route.list}>
          {(list) => (
            <TryoutSetTable
              bootstrap={list}
              key={`${locale}:${route.page.track.publicPath}`}
              title={route.page.track.title}
            />
          )}
        </Await>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
