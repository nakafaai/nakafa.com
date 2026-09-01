import { Effect } from "effect";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb-header";
import { FooterContent } from "@/components/shared/footer-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { RefContent } from "@/components/shared/ref-content";
import { TryoutCountryPageClient } from "@/components/tryout/catalog/country.client";
import { generateTryoutRouteMetadata } from "@/components/tryout/catalog/metadata";
import { buildTryoutCountryOptions } from "@/components/tryout/catalog/options";
import { TryoutCountrySelector } from "@/components/tryout/catalog/selector.client";
import {
  readTryoutCountryPage,
  readTryoutHubPage,
} from "@/components/tryout/catalog/server";
import { getTryoutHref } from "@/components/tryout/route/path";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { resolveTryoutExamArtwork } from "@/lib/tryout/artwork";
import { getAksaraTreeUrl } from "@/lib/utils/github";

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
export default function Page(props: {
  params: Promise<{ country: string; locale: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <TryoutCountryRoute params={props.params} />
    </Suspense>
  );
}

/** Resolves one cached public country inside its route-owned boundary. */
async function TryoutCountryRoute({
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
  const exams = page.exams.map((exam) => {
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
            menuLabel: tCommon("breadcrumb-menu"),
            openMenuLabel: tCommon("open-breadcrumb-menu"),
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
