import { COMPANY_IDENTITY } from "@repo/seo/company";
import { COMPANY_SOCIAL_PROFILE_URLS } from "@repo/seo/company-profiles";
import {
  FOUNDER_IDENTITY,
  FOUNDER_SOCIAL_PROFILE_URLS,
} from "@repo/seo/founder";
import type { IdReference, OrganizationLeaf, Person } from "schema-dts";

export const ORGANIZATION_ID = new URL("#organization", COMPANY_IDENTITY.url)
  .href;

export const ORGANIZATION_REFERENCE = {
  "@id": ORGANIZATION_ID,
} satisfies IdReference;

export const ORGANIZATION: OrganizationLeaf = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: COMPANY_IDENTITY.brandName,
  legalName: COMPANY_IDENTITY.legalName,
  url: COMPANY_IDENTITY.url,
  logo: COMPANY_IDENTITY.logoUrl,
  email: COMPANY_IDENTITY.email,
  telephone: COMPANY_IDENTITY.phone,
  sameAs: COMPANY_SOCIAL_PROFILE_URLS,
  contactPoint: {
    "@type": "ContactPoint",
    availableLanguage: ["English", "Indonesian", "German"],
    contactType: "customer support",
    email: COMPANY_IDENTITY.email,
    telephone: COMPANY_IDENTITY.phone,
  },
  employee: {
    "@type": "Person",
    name: COMPANY_IDENTITY.representative.name,
    jobTitle: COMPANY_IDENTITY.representative.role,
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: COMPANY_IDENTITY.registeredAddress.streetAddress,
    addressLocality: [
      COMPANY_IDENTITY.registeredAddress.village,
      COMPANY_IDENTITY.registeredAddress.district,
      COMPANY_IDENTITY.registeredAddress.regency,
    ].join(", "),
    addressRegion: COMPANY_IDENTITY.registeredAddress.region,
    postalCode: COMPANY_IDENTITY.registeredAddress.postalCode,
    addressCountry: COMPANY_IDENTITY.registeredAddress.countryCode,
  },
  identifier: [
    {
      "@type": "PropertyValue",
      propertyID: "Indonesian company registration certificate",
      value: COMPANY_IDENTITY.incorporationCertificateNumber,
    },
    {
      "@type": "PropertyValue",
      propertyID: "Indonesian Business Identification Number",
      value: COMPANY_IDENTITY.businessIdentificationNumber,
    },
  ],
};

export const FOUNDER: Person = {
  "@type": "Person",
  description: FOUNDER_IDENTITY.description,
  jobTitle: FOUNDER_IDENTITY.jobTitle,
  name: FOUNDER_IDENTITY.name,
  sameAs: FOUNDER_SOCIAL_PROFILE_URLS,
  url: FOUNDER_IDENTITY.url,
};
