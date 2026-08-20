import { COMPANY_IDENTITY } from "@repo/seo/company";
import {
  ORGANIZATION,
  ORGANIZATION_ID,
  ORGANIZATION_REFERENCE,
} from "@repo/seo/json-ld/constants";
import { describe, expect, it } from "vitest";

describe("organization JSON-LD", () => {
  it("preserves every registered locality component", () => {
    expect(ORGANIZATION.address).toMatchObject({
      streetAddress: COMPANY_IDENTITY.registeredAddress.streetAddress,
      addressLocality: "Sukahati, Cibinong, Kabupaten Bogor",
      addressRegion: COMPANY_IDENTITY.registeredAddress.region,
      postalCode: COMPANY_IDENTITY.registeredAddress.postalCode,
      addressCountry: COMPANY_IDENTITY.registeredAddress.countryCode,
    });
  });

  it("derives public identity from the reviewed company record", () => {
    expect(ORGANIZATION).toMatchObject({
      name: COMPANY_IDENTITY.brandName,
      legalName: COMPANY_IDENTITY.legalName,
      url: COMPANY_IDENTITY.url,
      email: COMPANY_IDENTITY.email,
      telephone: COMPANY_IDENTITY.phone,
    });
  });

  it("references the one canonical organization graph node", () => {
    expect(ORGANIZATION["@id"]).toBe(ORGANIZATION_ID);
    expect(ORGANIZATION_REFERENCE).toStrictEqual({ "@id": ORGANIZATION_ID });
  });
});
