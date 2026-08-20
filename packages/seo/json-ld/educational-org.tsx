import { COMPANY_IDENTITY } from "@repo/seo/company";
import { useTranslations } from "next-intl";
import type { EducationalOrganization, WithContext } from "schema-dts";
import { JsonLd } from ".";
import { FOUNDER, ORGANIZATION } from "./constants";

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
    ...ORGANIZATION,
    "@type": "EducationalOrganization",
    "@id": new URL("#educational-organization", COMPANY_IDENTITY.url).href,
    alternateName: t("title"),
    description: t("description"),
    image: COMPANY_IDENTITY.logoUrl,
    foundingDate: "2021",
    founder: FOUNDER,
    areaServed: COMPANY_IDENTITY.registeredAddress.country,
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
