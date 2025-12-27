import type { Organization, Person } from "schema-dts";

export const ORGANIZATION_URL = "https://nakafa.com";
export const ORGANIZATION_LOGO = "https://nakafa.com/logo.svg";
export const ORGANIZATION_NAME = "PT. Nakafa Tekno Kreatif";

export const SAME_AS_LINKS = [
  "https://twitter.com/nabilfatih_",
  "https://www.linkedin.com/company/nakafa",
  "https://www.instagram.com/nakafa.tv/",
] as const;

export const ORGANIZATION: Organization = {
  "@type": "Organization",
  name: ORGANIZATION_NAME,
  logo: ORGANIZATION_LOGO,
  url: ORGANIZATION_URL,
  sameAs: SAME_AS_LINKS,
};

export const FOUNDER: Person = {
  "@type": "Person",
  name: "Nabil Akbarazzima Fatih",
};
