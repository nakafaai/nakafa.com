import { describe, expect, it } from "@effect/vitest";
import { Option, Struct } from "effect";
import { EMPTY_OPEN_FORM, openRequest } from "@/components/operators/state";

/** A form an operator filled in completely. */
const FILLED = Struct.assign(EMPTY_OPEN_FORM, {
  contentLicense: " 2026-10 ",
  dpaVersion: " 2026-10 ",
  email: " owner@harapan.sch.id ",
  name: " SMA Harapan ",
  owner: " Ayu Lestari ",
  slug: "harapan",
});

describe("openRequest", () => {
  it("opens one unit with the school's name and every module, in the country's currency, language and first zone", () => {
    const request = openRequest(FILLED);

    expect(Option.getOrThrow(request)).toEqual({
      contract: {
        contentLicense: "2026-10",
        dpaVersion: "2026-10",
        modules: ["classes", "exams", "bank", "grades", "reports"],
        plan: "tenant",
      },
      country: "ID",
      currency: "IDR",
      kind: "school",
      name: "SMA Harapan",
      owner: { email: "owner@harapan.sch.id", name: "Ayu Lestari" },
      slug: "harapan",
      units: [
        {
          contentLanguage: "id",
          level: "sma",
          name: "SMA Harapan",
          timeZone: "Asia/Jakarta",
        },
      ],
    });
  });

  it("takes the defaults of the chosen country", () => {
    const request = openRequest(Struct.assign(FILLED, { country: "DE" as const }));

    expect(Option.getOrThrow(request)).toMatchObject({
      country: "DE",
      currency: "EUR",
      units: [{ contentLanguage: "de", timeZone: "Europe/Berlin" }],
    });
  });

  it.each([
    ["an empty form", EMPTY_OPEN_FORM],
    ["an address that is no email", Struct.assign(FILLED, { email: "owner" })],
    ["a slug with a space", Struct.assign(FILLED, { slug: "sma harapan" })],
    ["no DPA version", Struct.assign(FILLED, { dpaVersion: " " })],
  ])("makes no request from %s", (_, form) => {
    expect(Option.isNone(openRequest(form))).toBe(true);
  });
});
