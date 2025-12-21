import { type Locale, useTranslations } from "next-intl";
import type { WebSite, WithContext } from "schema-dts";
import { JsonLd } from ".";

interface Props {
  locale: Locale;
}

export function WebsiteJsonLd({ locale }: Props) {
  const t = useTranslations("Metadata");

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
    potentialAction: [
      {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://nakafa.com/search?q={search_term_string}",
        },
      },
    ],
  };

  return <JsonLd jsonLd={websiteJsonLd} />;
}
