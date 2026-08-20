import { COMPANY_IDENTITY } from "@repo/seo/company";
import { type Locale, useTranslations } from "next-intl";
import type { SearchAction, WebSite, WithContext } from "schema-dts";
import { JsonLd } from ".";
import { ORGANIZATION } from "./constants";

interface Props {
  locale: Locale;
}

const searchAction = {
  "@type": "SearchAction",
  target: {
    "@type": "EntryPoint",
    urlTemplate: `${COMPANY_IDENTITY.url}/search?q={search_term_string}`,
  },
  "query-input": "required name=search_term_string",
} satisfies SearchAction & { "query-input": string };

export function WebsiteJsonLd({ locale }: Props) {
  const t = useTranslations("Metadata");

  const websiteJsonLd: WithContext<WebSite> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": new URL("#website", COMPANY_IDENTITY.url).href,
    url: COMPANY_IDENTITY.url,
    name: COMPANY_IDENTITY.brandName,
    alternateName: t("title"),
    description: t("description"),
    publisher: ORGANIZATION,
    maintainer: ORGANIZATION,
    inLanguage: locale,
    potentialAction: searchAction,
  };

  return <JsonLd jsonLd={websiteJsonLd} />;
}
