import {
  COMPANY_IDENTITY,
  COMPANY_REGISTERED_ADDRESS,
  CompanyIdentitySchema,
} from "@repo/seo/company";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const decodeCompanyIdentity = Schema.decodeUnknownSync(CompanyIdentitySchema);

describe("company identity", () => {
  it("decodes the reviewed public company record", () => {
    expect(decodeCompanyIdentity(COMPANY_IDENTITY)).toEqual(COMPANY_IDENTITY);
    expect(COMPANY_REGISTERED_ADDRESS).toBe(
      "Taman Sukahati Permai Blok H-6, Sukahati, Cibinong, Kabupaten Bogor, Jawa Barat 16913, Indonesia"
    );
  });

  it("rejects malformed public URLs", () => {
    expect(() =>
      decodeCompanyIdentity({
        ...COMPANY_IDENTITY,
        url: "not-a-url",
      })
    ).toThrow("Expected a valid URL");
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
