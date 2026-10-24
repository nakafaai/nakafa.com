import { describe, expect, it } from "@effect/vitest";
import {
  billingEuroTerritoryCodes,
  billingOfferPrice,
} from "@repo/backend/confect/billing/catalog";
import { HashSet } from "effect";

describe("billing/catalog", () => {
  it("prices Pro monthly at the owner's rates in each currency", () => {
    expect(billingOfferPrice("pro.monthly", "IDR")).toBe(79_000);
    expect(billingOfferPrice("pro.monthly", "USD")).toBe(899);
    expect(billingOfferPrice("pro.monthly", "EUR")).toBe(899);
  });

  it("prices the Indonesian passes at 1, 3 and 12 months", () => {
    expect(billingOfferPrice("pro.pass.1", "IDR")).toBe(79_000);
    expect(billingOfferPrice("pro.pass.3", "IDR")).toBe(229_000);
    expect(billingOfferPrice("pro.pass.12", "IDR")).toBe(790_000);
  });

  it("returns null for a currency an offer is not priced in", () => {
    expect(billingOfferPrice("pro.pass.1", "USD")).toBeNull();
  });

  it("treats Germany and Ireland as euro territories and the United States as not", () => {
    expect(HashSet.has(billingEuroTerritoryCodes, "DE")).toBe(true);
    expect(HashSet.has(billingEuroTerritoryCodes, "IE")).toBe(true);
    expect(HashSet.has(billingEuroTerritoryCodes, "US")).toBe(false);
  });
});
