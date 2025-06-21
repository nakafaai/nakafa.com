import { useTranslations } from "next-intl";
import type { EducationalOrganization, WithContext } from "schema-dts";
import { JsonLd } from ".";

export function EducationalOrgJsonLd() {
  const t = useTranslations("Metadata");

  // Create JSON-LD with schema-dts for type safety
  const educationalOrganizationJsonLd: WithContext<EducationalOrganization> = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": "https://nakafa.com",
    name: t("title"),
    description: t("description"),
    url: "https://nakafa.com",
    logo: "https://nakafa.com/logo.svg",
    sameAs: [
      "https://twitter.com/nabilfatih_",
      "https://www.linkedin.com/company/nakafa",
      "https://www.instagram.com/nakafa.tv/",
    ],
    foundingDate: "2021",
    founder: {
      "@type": "Person",
      name: "Nabil Akbarazzima Fatih",
    },
  };

  return <JsonLd jsonLd={educationalOrganizationJsonLd} />;
}
