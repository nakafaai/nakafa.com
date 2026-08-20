import { Schema } from "effect";
import { COMPANY_SOCIAL_PROFILES } from "./company-profiles";

const NonEmptyTrimmedStringSchema = Schema.Trimmed.check(Schema.isNonEmpty());
const UrlStringSchema = Schema.String.check(
  Schema.makeFilter(
    (value) => URL.canParse(value) && new URL(value).protocol === "https:",
    { message: "Expected a valid HTTPS URL." }
  )
);
const EmailAddressSchema = Schema.String.check(
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
);
const PhoneNumberSchema = Schema.String.check(
  Schema.isPattern(/^\+\d[\d -]+$/)
);
const IncorporationCertificateNumberSchema = Schema.String.check(
  Schema.isPattern(/^AHU-\d{6}\.AH\.01\.30\.Tahun \d{4}$/)
);
const BusinessIdentificationNumberSchema = Schema.String.check(
  Schema.isPattern(/^\d{13}$/)
);

export const CompanyIdentitySchema = Schema.Struct({
  brandName: NonEmptyTrimmedStringSchema,
  legalName: NonEmptyTrimmedStringSchema,
  incorporationCertificateNumber: IncorporationCertificateNumberSchema,
  businessIdentificationNumber: BusinessIdentificationNumberSchema,
  representative: Schema.Struct({
    name: NonEmptyTrimmedStringSchema,
    role: NonEmptyTrimmedStringSchema,
  }),
  registeredAddress: Schema.Struct({
    streetAddress: NonEmptyTrimmedStringSchema,
    village: NonEmptyTrimmedStringSchema,
    district: NonEmptyTrimmedStringSchema,
    regency: NonEmptyTrimmedStringSchema,
    region: NonEmptyTrimmedStringSchema,
    postalCode: Schema.String.check(Schema.isPattern(/^\d{5}$/)),
    country: NonEmptyTrimmedStringSchema,
    countryCode: Schema.Literal("ID"),
  }),
  email: EmailAddressSchema,
  phone: PhoneNumberSchema,
  url: UrlStringSchema,
  logoUrl: UrlStringSchema,
  socialProfiles: Schema.Struct({
    discord: UrlStringSchema,
    github: UrlStringSchema,
    instagram: UrlStringSchema,
    linkedin: UrlStringSchema,
    twitter: UrlStringSchema,
    youtube: UrlStringSchema,
  }),
});

export type CompanyIdentity = Schema.Schema.Type<typeof CompanyIdentitySchema>;

/**
 * Public-safe corporate identity, registration, representation, address, and
 * telephone facts verified against the Indonesian company registration and
 * OSS records on 2026-08-20. The email and web profiles preserve Nakafa's
 * established public contact surfaces.
 *
 * Keep confidential personal identifiers, tax identifiers, and document
 * images out of this module.
 */
export const COMPANY_IDENTITY = Schema.decodeSync(CompanyIdentitySchema)({
  brandName: "Nakafa",
  legalName: "PT NAKAFA TEKNO KREATIF",
  incorporationCertificateNumber: "AHU-073724.AH.01.30.Tahun 2023",
  businessIdentificationNumber: "2710230144326",
  representative: {
    name: "Dian Bachtiar Nurdin",
    role: "Director",
  },
  registeredAddress: {
    streetAddress: "Taman Sukahati Permai Blok H-6",
    village: "Sukahati",
    district: "Cibinong",
    regency: "Kabupaten Bogor",
    region: "Jawa Barat",
    postalCode: "16913",
    country: "Indonesia",
    countryCode: "ID",
  },
  email: "nakafaai@gmail.com",
  phone: "+62 811-8992-531",
  url: "https://nakafa.com",
  logoUrl: "https://nakafa.com/logo.svg",
  socialProfiles: COMPANY_SOCIAL_PROFILES,
});

export const COMPANY_REGISTERED_ADDRESS = [
  COMPANY_IDENTITY.registeredAddress.streetAddress,
  COMPANY_IDENTITY.registeredAddress.village,
  COMPANY_IDENTITY.registeredAddress.district,
  COMPANY_IDENTITY.registeredAddress.regency,
  `${COMPANY_IDENTITY.registeredAddress.region} ${COMPANY_IDENTITY.registeredAddress.postalCode}`,
  COMPANY_IDENTITY.registeredAddress.country,
].join(", ");
