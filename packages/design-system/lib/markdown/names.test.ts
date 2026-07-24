import {
  aiDsComponentNames,
  biologyComponentNames,
  chemistryComponentNames,
  mathematicsComponentNames,
  physicsComponentNames,
  politicsComponentNames,
  snbtGeneralComponentNames,
  snbtMathComponentNames,
  snbtPlainComponentNames,
  snbtQuantComponentNames,
  tkaMathComponentNames,
} from "@repo/design-system/lib/markdown/names";
import { describe, expect, it } from "vitest";

const domainComponentNames = {
  "ai-ds": aiDsComponentNames,
  biology: biologyComponentNames,
  chemistry: chemistryComponentNames,
  mathematics: mathematicsComponentNames,
  physics: physicsComponentNames,
  politics: politicsComponentNames,
  "snbt-general": snbtGeneralComponentNames,
  "snbt-math": snbtMathComponentNames,
  "snbt-plain": snbtPlainComponentNames,
  "snbt-quant": snbtQuantComponentNames,
  "tka-math": tkaMathComponentNames,
};

describe("route-domain component names", () => {
  it("keeps exactly the finite route-domain registry contract", () => {
    expect(Object.keys(domainComponentNames)).toEqual([
      "ai-ds",
      "biology",
      "chemistry",
      "mathematics",
      "physics",
      "politics",
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

  it.each(
    Object.entries(domainComponentNames)
  )("keeps %s component names unique", (_domain, componentNames) => {
    const values = Object.values(componentNames);

    expect(new Set(values)).toHaveLength(values.length);
  });
});
