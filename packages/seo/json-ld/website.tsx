import { type Locale, useTranslations } from "next-intl";
import type { SearchAction, WebSite, WithContext } from "schema-dts";
import { JsonLd } from ".";

interface Props {
  locale: Locale;
}

export function WebsiteJsonLd({ locale }: Props) {
  const t = useTranslations("Metadata");

  const searchAction: SearchAction & { "query-input": string } = {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://nakafa.com/search?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  };

  const websiteJsonLd: WithContext<WebSite> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://nakafa.com/#website",
    url: "https://nakafa.com",
    name: t("title"),
    description: t("description"),
    publisher: {
      "@type": "Organization",
      name: "PT. Nakafa Tekno Kreatif",
      logo: "https://nakafa.com/logo.svg",
      url: "https://nakafa.com",
    },
    maintainer: {
      "@type": "Organization",
      name: "PT. Nakafa Tekno Kreatif",
      logo: "https://nakafa.com/logo.svg",
      url: "https://nakafa.com",
    },
    inLanguage: locale,
    potentialAction: searchAction,
  };

  return <JsonLd jsonLd={websiteJsonLd} />;
}
