import { Effect } from "effect";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { generateTryoutRouteMetadata } from "@/components/tryout/catalog/metadata";
import { buildTryoutExamOptions } from "@/components/tryout/catalog/options";
import { readTryoutCatalogRoutes } from "@/components/tryout/catalog/routes";
import { TryoutExamSelector } from "@/components/tryout/catalog/selector.client";
import {
  readTryoutCountryPage,
  readTryoutTrackPage,
} from "@/components/tryout/catalog/server";
import { TryoutTrackTable } from "@/components/tryout/catalog/track";
import { getTryoutHref } from "@/components/tryout/route/path";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * Lets a navigation into a track published after the build wait for its
 * server render. Every track the catalog served at build time is prerendered
 * whole below, but one published later has no page of its own until its first
 * visit upgrades it, and try-out pages render together with the app shell, so
 * no truthful fallback exists while it renders.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant#disabling-instant
 * @see https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components
 */
export const instant = false;

/**
 * Prerenders every track the published catalog serves, so a direct visit gets
 * the page, app shell included, from the static cache and only the learner's
 * own set list streams in below its heading.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-static-params#with-cache-components
 */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const routes = await Effect.runPromise(
    readTryoutCatalogRoutes(getLocaleOrThrow(params.locale))
  );
  return routes.tracks;
}

/** Builds route-owned metadata for one localized try-out track. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    track: string;
  }>;
}) {
  const { country, exam, locale: localeParam, track } = await params;
  const locale = getLocaleOrThrow(localeParam);

  return generateTryoutRouteMetadata({
    kind: "track",
    locale,
    publicPath: getTryoutHref({ country, exam, track }).slice(1),
  });
}

/** Renders active try-out sets for one exam track. */
export default async function Page({
  params,
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    track: string;
  }>;
}) {
  const { country, exam, locale: localeParam, track } = await params;
  const locale = getLocaleOrThrow(localeParam);
  const countryPath = getTryoutHref({ country }).slice(1);
  const examPath = getTryoutHref({ country, exam }).slice(1);
  const trackPath = getTryoutHref({ country, exam, track }).slice(1);

  const [page, countryPage] = await Promise.all([
    readTryoutTrackPage(locale, trackPath),
    readTryoutCountryPage(locale, countryPath),
  ]);

  if (!(page && countryPage)) {
    notFound();
  }

  const [tCommon, tTryouts] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);
  const examOptions = buildTryoutExamOptions(locale, countryPage.exams);

  return (
    <LayoutMaterial className="h-[calc(100svh-4rem)] flex-col overflow-clip lg:h-svh">
      <LayoutMaterialContent className="flex min-h-0 flex-1 flex-col">
        <BreadcrumbHeader
          action={
            <TryoutExamSelector
              currentValue={examPath}
              label={tTryouts("exam-selector-label")}
              options={examOptions}
            />
          }
          value={{
            homeLabel: tCommon("home"),
            items: [
              {
                href: getTryoutHref({ country }),
                label: tCommon("try-out"),
                menuLabel: tCommon("try-out-short"),
              },
              {
                href: getTryoutHref({ country, exam }),
                label: page.exam.title,
              },
              { label: page.track.title },
            ],
            menuLabel: tCommon("more"),
            title: page.track.title,
          }}
        />
        <Suspense fallback={null}>
          <TryoutTrackTable
            locale={locale}
            page={page}
            searchParams={searchParams}
          />
        </Suspense>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
