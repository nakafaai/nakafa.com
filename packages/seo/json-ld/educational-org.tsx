import { useTranslations } from "next-intl";
import type { EducationalOrganization, WithContext } from "schema-dts";
import { JsonLd } from ".";

/**
 * EducationalOrgJsonLd component generates Schema.org EducationalOrganization structured data
 *
 * This provides detailed educational institution information for search engines.
 * EducationalOrganization is a more specific type than Organization and includes
 * additional properties relevant to educational institutions.
 *
 * @see https://schema.org/EducationalOrganization
 */
export function EducationalOrgJsonLd() {
  const t = useTranslations("Metadata");

  const educationalOrganizationJsonLd: WithContext<EducationalOrganization> = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": "https://nakafa.com/#educational-organization",
    name: t("title"),
    alternateName: "Nakafa",
    description: t("description"),
    logo: "https://nakafa.com/logo.svg",
    image: "https://nakafa.com/logo.svg",
    url: "https://nakafa.com",
    sameAs: [
      "https://twitter.com/nabilfatih_",
      "https://www.linkedin.com/company/nakafa",
      "https://www.instagram.com/nakafa.ai/",
      "https://github.com/nakafaai",
      "https://www.youtube.com/@nakafaa",
    ],
    email: "contact@nakafa.com",
    foundingDate: "2021",
    founder: {
      "@type": "Person",
      name: "Nabil Akbarazzima Fatih",
      url: "https://nakafa.com/en/contributor",
    },
    areaServed: "Indonesia",
    knowsAbout: [
      "Education",
      "Mathematics",
      "Science",
      "Computer Science",
      "Artificial Intelligence",
      "K-12 Education",
      "University Level Education",
      "Online Learning",
      "Educational Technology",
    ],
  };

  return <JsonLd jsonLd={educationalOrganizationJsonLd} />;
}
