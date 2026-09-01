import { describe, expect, it } from "@effect/vitest";
import {
  COMPANY_IDENTITY,
  COMPANY_REGISTERED_ADDRESS,
  CompanyIdentitySchema,
} from "@repo/seo/company";
import { COMPANY_SOCIAL_PROFILE_URLS } from "@repo/seo/company-profiles";
import { Schema } from "effect";

const decodeCompanyIdentity = Schema.decodeUnknownSync(CompanyIdentitySchema);

describe("company identity", () => {
  it("decodes the reviewed public company record", () => {
    expect(decodeCompanyIdentity(COMPANY_IDENTITY)).toEqual(COMPANY_IDENTITY);
    expect(COMPANY_REGISTERED_ADDRESS).toBe(
      "Taman Sukahati Permai Blok H-6, Sukahati, Cibinong, Kabupaten Bogor, Jawa Barat 16913, Indonesia"
    );
    expect(COMPANY_SOCIAL_PROFILE_URLS).toEqual([
      "https://discord.gg/CPCSfKhvfQ",
      "https://github.com/nakafaai",
      "https://www.instagram.com/nakafa.ai/",
      "https://www.linkedin.com/company/nakafa",
      "https://twitter.com/nabilfatih_",
      "https://www.youtube.com/@nakafaa",
    ]);
  });

  it.each([
    "not-a-url",
    "http://nakafa.com",
    "ftp://nakafa.com",
    "javascript:alert(1)",
  ])("rejects the non-HTTPS public URL %s", (url) => {
    expect(() =>
      decodeCompanyIdentity({
        ...COMPANY_IDENTITY,
        url,
      })
    ).toThrow("Expected a valid HTTPS URL");
  });

  it("rejects malformed business identification numbers", () => {
    expect(() =>
      decodeCompanyIdentity({
        ...COMPANY_IDENTITY,
        businessIdentificationNumber: "123",
      })
    ).toThrow();
  });

  it("rejects a non-Indonesian registry country code", () => {
    expect(() =>
      decodeCompanyIdentity({
        ...COMPANY_IDENTITY,
        registeredAddress: {
          ...COMPANY_IDENTITY.registeredAddress,
          countryCode: "US",
        },
      })
    ).toThrow();
  });
});
