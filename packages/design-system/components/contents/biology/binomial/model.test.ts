// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  botanicalOf,
  gardenBedPosition,
  matchingPlants,
} from "@repo/design-system/components/contents/biology/binomial/model";

const ALL = [
  "kangkung",
  "sweetPotato",
  "mango",
  "beluntas",
  "neem",
  "padi",
] as const;

describe("garden name lab model", () => {
  it("matches close relatives on shared genus and unrelated species on shared epithet", () => {
    expect(matchingPlants(ALL, "kangkung", "genus")).toEqual([
      "kangkung",
      "sweetPotato",
    ]);
    expect(botanicalOf("kangkung").family).toBe(
      botanicalOf("sweetPotato").family
    );

    expect(matchingPlants(ALL, "mango", "epithet")).toEqual([
      "mango",
      "beluntas",
      "neem",
    ]);
    expect(botanicalOf("mango").family).toBe("Anacardiaceae");
    expect(botanicalOf("beluntas").family).toBe("Asteraceae");
    expect(botanicalOf("neem").family).toBe("Meliaceae");
    expect(matchingPlants(ALL, "padi", "epithet")).toEqual(["padi"]);
  });

  it("lays out garden beds in one row for small sets and two rows for up to six plants", () => {
    expect(gardenBedPosition(0, 1)).toEqual([0, 0, 0]);
    expect(gardenBedPosition(0, 6)[2]).toBeLessThan(0);
    expect(gardenBedPosition(3, 6)[2]).toBeGreaterThan(0);
    expect(gardenBedPosition(1, 6)[0]).toBe(0);
  });
});
