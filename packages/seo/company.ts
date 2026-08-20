import { Schema } from "effect";
import { COMPANY_SOCIAL_PROFILES } from "./company-profiles";

const UrlStringSchema = Schema.String.pipe(
  Schema.filter(
    (value) => URL.canParse(value) && new URL(value).protocol === "https:",
    {
      message: () => "Expected a valid HTTPS URL.",
    }
  )
);
const EmailAddressSchema = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
);
const PhoneNumberSchema = Schema.String.pipe(Schema.pattern(/^\+\d[\d -]+$/));
const IncorporationCertificateNumberSchema = Schema.String.pipe(
  Schema.pattern(/^AHU-\d{6}\.AH\.01\.30\.Tahun \d{4}$/)
);
const BusinessIdentificationNumberSchema = Schema.String.pipe(
  Schema.pattern(/^\d{13}$/)
);

export const CompanyIdentitySchema = Schema.Struct({
  brandName: Schema.NonEmptyTrimmedString,
  legalName: Schema.NonEmptyTrimmedString,
  incorporationCertificateNumber: IncorporationCertificateNumberSchema,
  businessIdentificationNumber: BusinessIdentificationNumberSchema,
  representative: Schema.Struct({
    name: Schema.NonEmptyTrimmedString,
    role: Schema.NonEmptyTrimmedString,
  }),
  registeredAddress: Schema.Struct({
    streetAddress: Schema.NonEmptyTrimmedString,
    village: Schema.NonEmptyTrimmedString,
    district: Schema.NonEmptyTrimmedString,
    regency: Schema.NonEmptyTrimmedString,
    region: Schema.NonEmptyTrimmedString,
    postalCode: Schema.String.pipe(Schema.pattern(/^\d{5}$/)),
    country: Schema.NonEmptyTrimmedString,
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
export const COMPANY_IDENTITY = Schema.decodeUnknownSync(CompanyIdentitySchema)(
  {
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
  }
);

export const COMPANY_REGISTERED_ADDRESS = [
  COMPANY_IDENTITY.registeredAddress.streetAddress,
  COMPANY_IDENTITY.registeredAddress.village,
  COMPANY_IDENTITY.registeredAddress.district,
  COMPANY_IDENTITY.registeredAddress.regency,
  `${COMPANY_IDENTITY.registeredAddress.region} ${COMPANY_IDENTITY.registeredAddress.postalCode}`,
  COMPANY_IDENTITY.registeredAddress.country,
].join(", ");
