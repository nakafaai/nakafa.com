import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { TryoutHubPage } from "@/components/tryout/hub-page";
import { getLocaleOrThrow } from "@/lib/i18n/params";
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
export default function Page(props: PageProps<"/[locale]/try-out">) {
  const locale = getLocaleOrThrow(use(props.params).locale);

  return (
    <>
      <PageBreadcrumb locale={locale} />
      <TryoutHubPage locale={locale} />
    </>
  );
}

/**
 * Emits the try-out hub breadcrumb from the same localized route labels used by
 * the visible navigation.
 */
function PageBreadcrumb({ locale }: { locale: Locale }) {
  const tCommon = useTranslations("Common");

  return (
    <BreadcrumbJsonLd
      breadcrumbItems={createBreadcrumbItems(locale, [
        { name: tCommon("home"), path: "" },
        { name: tCommon("try-out"), path: "/try-out" },
      ])}
    />
  );
}
