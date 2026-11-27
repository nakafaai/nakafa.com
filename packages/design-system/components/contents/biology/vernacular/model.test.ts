// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  seaCommonName,
  seaSlotPosition,
  seaSpeciesOf,
} from "@repo/design-system/components/contents/biology/vernacular/model";

describe("sea name lab model", () => {
  it("keeps cited scientific names and distinguishes the true fish from mammals and invertebrates", () => {
    expect(seaSpeciesOf("dugong").scientific).toBe("Dugong dugon");
    expect(seaSpeciesOf("dugong").isFish).toBe(false);
    expect(seaSpeciesOf("whale").scientific).toBe("Balaenoptera edeni");
    expect(seaSpeciesOf("whale").isFish).toBe(false);
    expect(seaSpeciesOf("jellyfish").isFish).toBe(false);
    expect(seaSpeciesOf("seaStar").isFish).toBe(false);
    expect(seaSpeciesOf("mackerel").scientific).toBe("Rastrelliger kanagurta");
    expect(seaSpeciesOf("mackerel").isFish).toBe(true);
  });

  it("places a full five-animal cast at curated depths and spaces smaller subsets evenly", () => {
    const full = [
      "dugong",
      "whale",
      "jellyfish",
      "seaStar",
      "mackerel",
    ] as const;
    expect(seaSlotPosition(full, "dugong")).toEqual([-1, 0.36, 0.45]);

    const pair = ["dugong", "mackerel"] as const;
    expect(seaSlotPosition(pair, "dugong")).toEqual([-1.2, 0.36, 0.25]);
    expect(seaSlotPosition(pair, "mackerel")).toEqual([1.2, 0.8, -0.25]);

    const single = ["seaStar"] as const;
    expect(seaSlotPosition(single, "seaStar")).toEqual([0, 0.08, 0.25]);
    expect(seaSlotPosition(single, "whale")).toEqual([0, 1.06, 0.25]);
  });

  it("resolves common names per language and falls back to the scientific name when absent", () => {
    const names = {
      dugong: { english: "dugong", malay: "duyung" },
    };
    expect(seaCommonName(names, "dugong", "malay")).toBe("duyung");
    expect(seaCommonName(names, "dugong", "english")).toBe("dugong");
    expect(seaCommonName(names, "dugong", "german")).toBe("Dugong dugon");
  });
});
