import { useTranslations } from "next-intl";
import type { Organization, WithContext } from "schema-dts";
import { JsonLd } from ".";

/**
 * OrganizationJsonLd component generates Schema.org Organization structured data
 *
 * This provides general business/organization information for search engines.
 * Used alongside EducationalOrganization for comprehensive structured data coverage.
 *
 * @see https://schema.org/Organization
 */
export function OrganizationJsonLd() {
  const t = useTranslations("Metadata");

  const organizationJsonLd: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://nakafa.com/#organization",
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
    areaServed: "Indonesia",
    knowsAbout: [
      "Education",
      "Mathematics",
      "Science",
      "Computer Science",
      "Artificial Intelligence",
      "K-12 Education",
      "University Level Education",
    ],
  };

  return <JsonLd jsonLd={organizationJsonLd} />;
}
