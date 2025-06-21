import { type Locale, useTranslations } from "next-intl";
import type { BreadcrumbList, WithContext } from "schema-dts";
import { JsonLd } from ".";

type Props = {
  id?: string;
  locale: Locale;
  breadcrumbItems: BreadcrumbList["itemListElement"];
  name?: string;
  description?: string;
};

export function BreadcrumbJsonLd({
  id = "breadcrumb-jsonld",
  locale,
  breadcrumbItems,
  name,
  description,
}: Props) {
  const t = useTranslations("Metadata");

  const breadcrumbJsonLd: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `https://nakafa.com/${locale}#breadcrumb`,
    url: `https://nakafa.com/${locale}`,
    name: name ?? t("title"),
    description: description ?? t("description"),
    potentialAction: [
      {
        "@type": "SearchAction",
        "@id": `https://nakafa.com/${locale}/search`,
        target: `https://nakafa.com/${locale}/search?q={search_term_string}`,
        query: "search_term_string",
      },
    ],
    itemListElement: breadcrumbItems,
  };

  return <JsonLd jsonLd={breadcrumbJsonLd} />;
}
