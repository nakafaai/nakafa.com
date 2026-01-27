import {
  createPerson,
  OrganizationSchema,
  type Person,
} from "@repo/seo/json-ld/schemas";

export const ORGANIZATION_URL = "https://nakafa.com";
export const ORGANIZATION_LOGO = "https://nakafa.com/logo.svg";
export const ORGANIZATION_NAME = "PT. Nakafa Tekno Kreatif";

export const SAME_AS_LINKS = [
  "https://twitter.com/nabilfatih_",
  "https://www.linkedin.com/company/nakafa",
  "https://www.instagram.com/nakafa.tv/",
] as const;

export const ORGANIZATION = OrganizationSchema.parse({
  "@type": "Organization",
  name: ORGANIZATION_NAME,
  url: ORGANIZATION_URL,
  logo: ORGANIZATION_LOGO,
  sameAs: SAME_AS_LINKS,
});

export const FOUNDER: Person = createPerson("Nabil Akbarazzima Fatih");
