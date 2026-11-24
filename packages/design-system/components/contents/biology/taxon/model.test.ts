// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  compareTaxons,
  lineageOf,
} from "@repo/design-system/components/contents/biology/taxon/model";
import { Option } from "effect";

describe("taxon rank lab model", () => {
  it("computes the exact shared rank depth and lowest taxon for every pair", () => {
    const tigerBear = compareTaxons("tiger", "sunBear");
    expect(tigerBear.count).toBe(4);
    expect(tigerBear.lowestRank).toEqual(Option.some("order"));
    expect(tigerBear.lowestTaxon).toEqual(Option.some("Carnivora"));

    const tigerCat = compareTaxons("tiger", "leopardCat");
    expect(tigerCat.count).toBe(5);
    expect(tigerCat.lowestRank).toEqual(Option.some("family"));
    expect(tigerCat.lowestTaxon).toEqual(Option.some("Felidae"));

    const tigerLeopard = compareTaxons("tiger", "leopard");
    expect(tigerLeopard.count).toBe(6);
    expect(tigerLeopard.lowestRank).toEqual(Option.some("genus"));

    const bearTapir = compareTaxons("sunBear", "tapir");
    expect(bearTapir.count).toBe(3);
    expect(bearTapir.lowestRank).toEqual(Option.some("class"));

    const tigerPadi = compareTaxons("tiger", "padi");
    expect(tigerPadi.count).toBe(0);
    expect(Option.isNone(tigerPadi.lowestRank)).toBe(true);
    expect(Option.isNone(tigerPadi.lowestTaxon)).toBe(true);

    const same = compareTaxons("tiger", "tiger");
    expect(same.count).toBe(7);
    expect(lineageOf("tiger").species).toBe("Panthera tigris");
  });
});
