import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { FooterContent } from "@/components/shared/footer-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { RefContent } from "@/components/shared/ref-content";
import { TryoutHubClient } from "@/components/tryout/catalog/hub.client";
import { readTryoutHubPage } from "@/components/tryout/catalog/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getAppSocialArtwork } from "@/lib/og/app-artwork";
import { createLocalizedAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getAksaraTreeUrl } from "@/lib/utils/github";
import { getSocialMetadata } from "@/lib/utils/metadata";

/**
 * Builds metadata-only copy for the try-out hub while keeping helper prose out
 * of the visible hub header.
 */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/try-out">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const [tCommon, tTryouts] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);

  const path = `/${locale}/try-out`;
  const title = tCommon("try-out");
  const description = tTryouts("metadata-description");
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getAppSocialArtwork({
      key: "try-out",
      locale,
      publicPath: "try-out",
    }),
  });

  return {
    title,
    description,
    alternates: createLocalizedAlternates(path),
    ...socialMetadata,
  };
}

/**
 * Composes the localized try-out hub and JSON-LD breadcrumb for the canonical
 * try-out entry page.
 */
export default async function Page() {
  const locale = getLocaleOrThrow(await rootLocale());
  return <TryoutHubRoute locale={locale} />;
}

/** Resolves the cached public hub for the localized App Shell. */
async function TryoutHubRoute({
  locale,
}: {
  locale: ReturnType<typeof getLocaleOrThrow>;
}) {
  const [page, tCommon] = await Promise.all([
    readTryoutHubPage(locale),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  const title = tCommon("try-out");
  const sourceUrl = page.sourceRevision
    ? getAksaraTreeUrl({
        path: "packages/corpus/tryout",
        revision: page.sourceRevision,
      })
    : undefined;

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: title, path: "/try-out" },
        ])}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <BreadcrumbHeader
            value={{
              homeLabel: tCommon("home"),
              items: [{ label: title }],
              menuLabel: tCommon("navigate"),
              title,
            }}
          />
          <LayoutContent>
            <TryoutHubClient locale={locale} page={page} />
          </LayoutContent>
          <FooterContent>
            <RefContent githubUrl={sourceUrl} />
          </FooterContent>
        </LayoutMaterialContent>
      </LayoutMaterial>
    </>
  );
}
