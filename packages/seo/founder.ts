import { Schema } from "effect";

const HttpsUrlSchema = Schema.String.check(
  Schema.makeFilter(
    (value) => URL.canParse(value) && new URL(value).protocol === "https:",
    { message: "Expected a valid HTTPS URL." }
  )
);

export const FounderIdentitySchema = Schema.Struct({
  description: Schema.Trimmed.check(Schema.isNonEmpty()),
  jobTitle: Schema.Literal("Founder"),
  name: Schema.Trimmed.check(Schema.isNonEmpty()),
  socialProfiles: Schema.Struct({
    github: HttpsUrlSchema,
    linkedin: HttpsUrlSchema,
    twitter: HttpsUrlSchema,
  }),
  url: HttpsUrlSchema,
  username: Schema.Trimmed.check(Schema.isNonEmpty()),
});

export type FounderIdentity = Schema.Schema.Type<typeof FounderIdentitySchema>;

/** Public founder identity already verified by Nakafa's contributor surface. */
export const FOUNDER_IDENTITY = Schema.decodeSync(FounderIdentitySchema)({
  description:
    "Founder of Nakafa, building open multilingual learning tools and agent-readable education infrastructure.",
  jobTitle: "Founder",
  name: "Nabil Akbarazzima Fatih",
  socialProfiles: {
    github: "https://github.com/nabilfatih",
    linkedin: "https://www.linkedin.com/in/nabilfatih",
    twitter: "https://x.com/nabilfatih_",
  },
  url: "https://nakafa.com/en/contributor",
  username: "nabilfatih",
});

export const FOUNDER_SOCIAL_PROFILE_URLS = Object.values(
  FOUNDER_IDENTITY.socialProfiles
);
