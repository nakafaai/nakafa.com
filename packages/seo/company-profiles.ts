/**
 * Public company destinations shared by server and browser surfaces.
 *
 * This data-only module keeps client consumers from loading the Effect schema
 * runtime used to validate the complete corporate identity record.
 */
export const COMPANY_SOCIAL_PROFILES = {
  discord: "https://discord.gg/CPCSfKhvfQ",
  github: "https://github.com/nakafaai",
  instagram: "https://www.instagram.com/nakafa.ai/",
  linkedin: "https://www.linkedin.com/company/nakafa",
  twitter: "https://twitter.com/nabilfatih_",
  youtube: "https://www.youtube.com/@nakafaa",
} as const;

export const COMPANY_SOCIAL_PROFILE_URLS = Object.values(
  COMPANY_SOCIAL_PROFILES
);
