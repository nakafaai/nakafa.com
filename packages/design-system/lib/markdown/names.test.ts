import { describe, expect, it } from "@effect/vitest";
import {
  aiDsComponentNames,
  biologyComponentNames,
  chemistryComponentNames,
  mathematicsComponentNames,
  physicsComponentNames,
  politicsComponentNames,
  siteComponentNames,
  snbtGeneralComponentNames,
  snbtMathComponentNames,
  snbtPlainComponentNames,
  snbtQuantComponentNames,
  tkaMathComponentNames,
} from "@repo/design-system/lib/markdown/names";
import { Array as Arr, Record as Rec } from "effect";

const domainComponentNames = {
  "ai-ds": aiDsComponentNames,
  biology: biologyComponentNames,
  chemistry: chemistryComponentNames,
  mathematics: mathematicsComponentNames,
  physics: physicsComponentNames,
  politics: politicsComponentNames,
  site: siteComponentNames,
  "snbt-general": snbtGeneralComponentNames,
  "snbt-math": snbtMathComponentNames,
  "snbt-plain": snbtPlainComponentNames,
  "snbt-quant": snbtQuantComponentNames,
  "tka-math": tkaMathComponentNames,
};

describe("route-domain component names", () => {
  it("keeps exactly the finite route-domain registry contract", () => {
    expect(Rec.keys(domainComponentNames)).toEqual([
      "ai-ds",
      "biology",
      "chemistry",
      "mathematics",
      "physics",
      "politics",
      "site",
      "snbt-general",
      "snbt-math",
      "snbt-plain",
      "snbt-quant",
      "tka-math",
    ]);
  });

  it("uses unambiguous article component identities", () => {
    expect(politicsComponentNames.kimPlusElectabilityChart).toBe(
      "KimPlusElectabilityChart"
    );
    expect(politicsComponentNames.porkBarrelElectabilityChart).toBe(
      "PorkBarrelElectabilityChart"
    );
  });

  it.each(Rec.toEntries(domainComponentNames))(
    "keeps %s component names unique",
    (_domain, componentNames) => {
      const values = Rec.values<string, string>(componentNames);

      expect(Arr.dedupe(values)).toHaveLength(values.length);
    }
  );
});
