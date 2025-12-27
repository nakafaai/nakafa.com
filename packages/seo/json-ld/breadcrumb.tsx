import { type Locale, useTranslations } from "next-intl";
import type { BreadcrumbList, WithContext } from "schema-dts";
import { JsonLd } from ".";
import { ORGANIZATION_URL } from "./constants";

interface Props {
  locale: Locale;
  breadcrumbItems: BreadcrumbList["itemListElement"];
  name?: string;
  description?: string;
}

export function BreadcrumbJsonLd({
  locale,
  breadcrumbItems,
  name,
  description,
}: Props) {
  const t = useTranslations("Metadata");

  const breadcrumbJsonLd: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${ORGANIZATION_URL}/${locale}#breadcrumb`,
    url: `${ORGANIZATION_URL}/${locale}`,
    name: name ?? t("title"),
    description: description ?? t("description"),
    potentialAction: [
      {
        "@type": "SearchAction",
        "@id": `${ORGANIZATION_URL}/${locale}/search`,
        target: `${ORGANIZATION_URL}/${locale}/search?q={search_term_string}`,
        query: "search_term_string",
      },
    ],
    itemListElement: breadcrumbItems,
  };

  return <JsonLd jsonLd={breadcrumbJsonLd} />;
}
