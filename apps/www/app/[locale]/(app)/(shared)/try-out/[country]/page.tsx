import { Array as Arr, Effect } from "effect";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/layout";
import { RefContent } from "@/components/shared/content/references";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { TryoutCountryPageClient } from "@/components/tryout/catalog/country.client";
import { generateTryoutRouteMetadata } from "@/components/tryout/catalog/metadata";
import { buildTryoutCountryOptions } from "@/components/tryout/catalog/options";
import { readTryoutCatalogRoutes } from "@/components/tryout/catalog/routes";
import { TryoutCountrySelector } from "@/components/tryout/catalog/selector.client";
import {
  readTryoutCountryPage,
  readTryoutHubPage,
} from "@/components/tryout/catalog/server";
import { getTryoutHref } from "@/components/tryout/route/path";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { resolveTryoutExamArtwork } from "@/lib/tryout/artwork";
import { getAksaraTreeUrl } from "@/lib/utils/github";

/**
 * Lets a navigation into a country published after the build wait for its
 * server render. Every country the catalog served at build time is prerendered
 * whole below, but one published later has no page of its own until its first
 * visit upgrades it, and try-out pages render together with the app shell, so
 * no truthful fallback exists while it renders.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/instant#disabling-instant
 * @see https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components
 */
export const instant = false;

/**
 * Prerenders every country the published catalog serves, so a direct visit gets
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
  return routes.countries;
}

/** Builds route-owned metadata for one localized try-out country. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; locale: string }>;
}) {
  const { country, locale: localeParam } = await params;
  const locale = getLocaleOrThrow(localeParam);

  return generateTryoutRouteMetadata({
    kind: "country",
    locale,
    publicPath: getTryoutHref({ country }).slice(1),
  });
}

/** Renders active exam families for one try-out country. */
export default async function Page({
  params,
}: {
  params: Promise<{ country: string; locale: string }>;
}) {
  const { country, locale: localeParam } = await params;
  const locale = getLocaleOrThrow(localeParam);
  const countryPath = getTryoutHref({ country }).slice(1);

  const [page, hub] = await Promise.all([
    readTryoutCountryPage(locale, countryPath),
    readTryoutHubPage(locale),
  ]);

  if (!page) {
    notFound();
  }

  const [tCommon, tTryouts] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);
  const countryOptions = buildTryoutCountryOptions(locale, hub.countries);
  const exams = Arr.map(page.exams, (exam) => {
    const artwork = Effect.runSync(
      resolveTryoutExamArtwork({
        countryKey: page.country.countryKey,
        examKey: exam.examKey,
        appLocale: locale,
        publicPath: exam.publicPath,
      })
    );
    if (!artwork.cardImageSrc) {
      return exam;
    }
    return { ...exam, imageSrc: artwork.cardImageSrc };
  });
  const sourceUrl = page.sourceRevision
    ? getAksaraTreeUrl({
        path: `packages/corpus/tryout/${country}`,
        revision: page.sourceRevision,
      })
    : undefined;

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <BreadcrumbHeader
          value={{
            action:
              countryOptions.length > 0 ? (
                <TryoutCountrySelector
                  currentValue={countryPath}
                  label={tTryouts("country-selector-label")}
                  options={countryOptions}
                />
              ) : undefined,
            homeLabel: tCommon("home"),
            items: [{ label: tCommon("try-out") }],
            menuLabel: tCommon("more"),
            title: tCommon("try-out"),
          }}
        />
        <LayoutContent>
          <TryoutCountryPageClient
            actionLabel={tTryouts("open-exam-cta")}
            page={{ exams }}
          />
        </LayoutContent>
        <FooterContent>
          <RefContent githubUrl={sourceUrl} />
        </FooterContent>
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
