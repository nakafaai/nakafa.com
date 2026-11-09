import { describe, expect, it } from "@effect/vitest";
import {
  baseComponentNames,
  biologyComponentNames,
  chemistryComponentNames,
  mathematicsComponentNames,
  physicsComponentNames,
  politicsComponentNames,
} from "@repo/design-system/lib/markdown/names";
import { Array as Arr, Record as Rec } from "effect";

const componentNames = [
  baseComponentNames,
  biologyComponentNames,
  chemistryComponentNames,
  mathematicsComponentNames,
  physicsComponentNames,
  politicsComponentNames,
];

describe("rich component names", () => {
  it("names every component once across the base and every subject's visuals", () => {
    const names = Arr.flatMap(componentNames, (map) =>
      Rec.values<string, string>(map)
    );

    expect(Arr.dedupe(names)).toHaveLength(names.length);
  });

  it("uses unambiguous article component identities", () => {
    expect(politicsComponentNames.kimPlusElectabilityChart).toBe(
      "KimPlusElectabilityChart"
    );
    expect(politicsComponentNames.porkBarrelElectabilityChart).toBe(
      "PorkBarrelElectabilityChart"
    );
  });
});
