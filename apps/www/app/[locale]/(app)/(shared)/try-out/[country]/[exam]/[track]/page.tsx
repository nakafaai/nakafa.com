import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { generateTryoutRouteMetadata } from "@/components/tryout/catalog/metadata";
import { buildTryoutExamOptions } from "@/components/tryout/catalog/options";
import { TryoutExamSelector } from "@/components/tryout/catalog/selector.client";
import {
  readTryoutCountryPage,
  readTryoutTrackPage,
} from "@/components/tryout/catalog/server";
import { TryoutTrackPageClient } from "@/components/tryout/catalog/track.client";
import { getTryoutHref } from "@/components/tryout/route/path";
import { getLocaleOrThrow } from "@/lib/i18n/params";

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
export default function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    track: string;
  }>;
}) {
  return (
    <Suspense fallback={null}>
      <TryoutTrackRoute params={props.params} />
    </Suspense>
  );
}

/** Resolves one cached public track inside its route-owned boundary. */
async function TryoutTrackRoute({
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
          value={{
            action: (
              <TryoutExamSelector
                currentValue={examPath}
                label={tTryouts("exam-selector-label")}
                options={examOptions}
              />
            ),
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
        <TryoutTrackPageClient locale={locale} page={page} />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
