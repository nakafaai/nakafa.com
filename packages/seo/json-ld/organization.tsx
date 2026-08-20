import { COMPANY_IDENTITY } from "@repo/seo/company";
import { useTranslations } from "next-intl";
import type { Organization, WithContext } from "schema-dts";
import { JsonLd } from ".";
import { ORGANIZATION } from "./constants";

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
    ...ORGANIZATION,
    alternateName: t("title"),
    description: t("description"),
    image: COMPANY_IDENTITY.logoUrl,
    foundingDate: "2021",
    areaServed: COMPANY_IDENTITY.registeredAddress.country,
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
