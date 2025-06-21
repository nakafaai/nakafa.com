import { useTranslations } from "next-intl";
import type { Organization, WithContext } from "schema-dts";
import { JsonLd } from ".";

export function OrganizationJsonLd() {
  const t = useTranslations("Metadata");

  const organizationJsonLd: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: t("title"),
    logo: "https://nakafa.com/logo.svg",
    url: "https://nakafa.com",
    sameAs: [
      "https://twitter.com/nabilfatih_",
      "https://www.linkedin.com/company/nakafa",
      "https://www.instagram.com/nakafa.tv/",
    ],
  };

  return <JsonLd jsonLd={organizationJsonLd} />;
}
