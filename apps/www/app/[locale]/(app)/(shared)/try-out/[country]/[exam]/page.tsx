import { Effect } from "effect";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { TryoutExamPageClient } from "@/components/tryout/catalog/exam.client";
import { generateTryoutRouteMetadata } from "@/components/tryout/catalog/metadata";
import { buildTryoutExamOptions } from "@/components/tryout/catalog/options";
import { readTryoutCatalogRoutes } from "@/components/tryout/catalog/routes";
import { TryoutExamSelector } from "@/components/tryout/catalog/selector.client";
import {
  readTryoutCountryPage,
  readTryoutExamPage,
} from "@/components/tryout/catalog/server";
import { getTryoutHref } from "@/components/tryout/route/path";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * Lets a navigation into a exam published after the build block on its first
 * render. Every exam the catalog served at build time is prerendered whole
 * below. One published later has no static shell of its own until that first
 * visit upgrades it, because try-out pages render together with the app shell,
 * so static shell validation would reject its empty fallback.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant#disabling-static-shell-validation
 * @see https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components
 */
export const instant = false;

/**
 * Prerenders every exam the published catalog serves, so a direct visit gets
 * the whole page, app shell included, from the static cache.
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
  return routes.exams;
}

/** Builds route-owned metadata for one localized try-out exam. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; exam: string; locale: string }>;
}) {
  const { country, exam, locale: localeParam } = await params;
  const locale = getLocaleOrThrow(localeParam);

  return generateTryoutRouteMetadata({
    kind: "exam",
    locale,
    publicPath: getTryoutHref({ country, exam }).slice(1),
  });
}

/** Renders active try-out tracks for one country and exam family. */
export default async function Page({
  params,
}: {
  params: Promise<{ country: string; exam: string; locale: string }>;
}) {
  const { country, exam, locale: localeParam } = await params;
  const locale = getLocaleOrThrow(localeParam);
  const countryPath = getTryoutHref({ country }).slice(1);
  const examPath = getTryoutHref({ country, exam }).slice(1);

  const [page, countryPage] = await Promise.all([
    readTryoutExamPage(locale, examPath),
    readTryoutCountryPage(locale, countryPath),
  ]);

  if (!(page && countryPage)) {
    notFound();
  }

  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const tTryouts = await getTranslations({ locale, namespace: "Tryouts" });
  const examOptions = buildTryoutExamOptions(locale, countryPage.exams);

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
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
              { label: page.exam.title },
            ],
            menuLabel: tCommon("more"),
            title: page.exam.title,
          }}
        />
        <TryoutExamPageClient locale={locale} page={page} />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
