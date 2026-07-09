import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FooterContent } from "@/components/shared/footer-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { RefContent } from "@/components/shared/ref-content";
import { TryoutHubClient } from "@/components/tryout/catalog/hub.client";
import { TryoutHeader } from "@/components/tryout/shell/chrome";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

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
    image: getOgUrl(locale, "/try-out"),
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
export default async function Page(props: PageProps<"/[locale]/try-out">) {
  const locale = getLocaleOrThrow((await props.params).locale);
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const title = tCommon("try-out");

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
          <TryoutHeader
            value={{
              homeLabel: tCommon("home"),
              items: [{ label: title }],
              title,
            }}
          />
          <LayoutContent>
            <TryoutHubClient locale={locale} />
          </LayoutContent>
          <FooterContent>
            <RefContent
              githubUrl={getGithubUrl({
                path: "/packages/contents/tryout",
              })}
            />
          </FooterContent>
        </LayoutMaterialContent>
      </LayoutMaterial>
    </>
  );
}
