import { describe, expect, it } from "@effect/vitest";
import { billingOfferPrice } from "@repo/backend/confect/billing/catalog";
import { schoolTiers } from "@repo/backend/confect/billing/tiers";
import {
  CountryProfile,
  countryOfCurrency,
  countryProfiles,
  currencyOfCountry,
  OpenCountry,
  railOfCountry,
} from "@repo/backend/confect/country/registry";
import { Array as Arr, Option, Schema } from "effect";

describe("country/registry", () => {
  it("holds a real currency, language, school year and time zones for every open country", () => {
    for (const country of OpenCountry.literals) {
      expect(Schema.is(CountryProfile)(countryProfiles[country])).toBe(true);
    }
  });

  // A country that pays in a currency the catalog does not sell in could not check out.
  it("names for every open country a currency that Pro and every School plan are priced in", () => {
    for (const country of OpenCountry.literals) {
      const { currency } = countryProfiles[country];
      for (const offer of ["pro.monthly", "pro.yearly", "pro.topup"] as const) {
        expect(billingOfferPrice(offer, currency)).not.toBeNull();
      }
      expect(schoolTiers.pro.monthly[currency]).toBeGreaterThan(0);
    }
  });

  it("bills Malaysia in ringgit, Indonesia in rupiah, the euro territories in euros and the rest in dollars", () => {
    expect(currencyOfCountry("MY")).toBe("MYR");
    expect(currencyOfCountry("ID")).toBe("IDR");
    expect(currencyOfCountry("DE")).toBe("EUR");
    expect(currencyOfCountry("FR")).toBe("EUR");
    expect(currencyOfCountry("SG")).toBe("USD");
    expect(currencyOfCountry("BR")).toBe("USD");
  });

  it("takes Indonesia's money through Xendit and every other country's through Polar", () => {
    expect(railOfCountry("ID")).toBe("xendit");
    expect(railOfCountry("MY")).toBe("polar");
    expect(railOfCountry("BR")).toBe("polar");
  });

  it("routes a currency as the one open country that pays in it", () => {
    expect(countryOfCurrency("IDR")).toEqual(Option.some("ID"));
    expect(countryOfCurrency("MYR")).toEqual(Option.some("MY"));
    expect(countryOfCurrency("EUR")).toEqual(Option.some("DE"));
    expect(countryOfCurrency("USD")).toEqual(Option.none());
  });

  it("lets a Malaysian school choose Malaysian levels by their own names, and a Singaporean one the shared stages", () => {
    expect(countryProfiles.MY.levelNames).toBe("national");
    expect(countryProfiles.MY.levels).toEqual([
      "my-sk",
      "my-smk",
      "my-smka",
      "my-form6",
      "other",
    ]);
    expect(countryProfiles.SG.levelNames).toBe("stage");
    expect(Arr.contains(countryProfiles.SG.levels, "my-smk")).toBe(false);
  });

  it("starts a Malaysian school in English, on its own zones, with a school year from January", () => {
    expect(countryProfiles.MY.locale).toBe("en");
    expect(countryProfiles.MY.yearStart).toBe(1);
    expect(Arr.contains(countryProfiles.MY.zones, "Asia/Kuala_Lumpur")).toBe(
      true
    );
  });
});
