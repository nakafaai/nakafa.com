import { describe, expect, it } from "@effect/vitest";
import { LOGO_BYTE_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { logoAnswerOutcome, logoRefusalOf } from "@/components/tenant/logo";

describe("tenant/logo refusalOf", () => {
  it("refuses a file that is not a PNG or an SVG image, before any upload", () => {
    expect(logoRefusalOf({ size: 8, type: "text/plain" })).toBe("type");
    expect(logoRefusalOf({ size: 8, type: "image/jpeg" })).toBe("type");
  });

  it("refuses a file of more than one megabyte, and takes one of exactly one megabyte", () => {
    expect(
      logoRefusalOf({ size: LOGO_BYTE_LIMIT + 1, type: "image/png" })
    ).toBe("size");
    expect(
      logoRefusalOf({ size: LOGO_BYTE_LIMIT, type: "image/svg+xml" })
    ).toBeUndefined();
  });

  it("takes a small PNG or SVG logo", () => {
    expect(logoRefusalOf({ size: 8, type: "image/png" })).toBeUndefined();
    expect(logoRefusalOf({ size: 8, type: "image/svg+xml" })).toBeUndefined();
  });
});

describe("tenant/logo answerOutcome", () => {
  it("shows a saved logo for a set answer, and a refusal for a refused file", () => {
    expect(
      logoAnswerOutcome({
        _tag: "LogoSet",
        logo: "https://example.test/logo.png",
      })
    ).toBe("saved");
    expect(logoAnswerOutcome({ _tag: "LogoRefused", reason: "size" })).toBe(
      "refused"
    );
  });
});
