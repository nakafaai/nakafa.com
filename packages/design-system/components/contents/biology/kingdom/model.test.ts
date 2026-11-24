// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  isPlacementRight,
  KINGDOMS,
  kingdomTrayPosition,
  specimenProfileOf,
} from "@repo/design-system/components/contents/biology/kingdom/model";

describe("kingdom sort lab model", () => {
  it("distinguishes hot-spring prokaryotes by peptidoglycan and spirogyra from plantae by tissues", () => {
    expect(specimenProfileOf("sulfolobus").wall).toBe("noPeptidoglycan");
    expect(isPlacementRight("sulfolobus", "archaebacteria")).toBe(true);
    expect(isPlacementRight("sulfolobus", "eubacteria")).toBe(false);

    expect(specimenProfileOf("thermus").wall).toBe("peptidoglycan");
    expect(isPlacementRight("thermus", "eubacteria")).toBe(true);

    expect(specimenProfileOf("spirogyra").cells).toBe("many");
    expect(isPlacementRight("spirogyra", "protista")).toBe(true);
    expect(isPlacementRight("spirogyra", "plantae")).toBe(false);

    expect(specimenProfileOf("padi").cells).toBe("tissue");
    expect(isPlacementRight("padi", "plantae")).toBe(true);
    expect(isPlacementRight("hydra", "animalia")).toBe(true);
    expect(isPlacementRight("mushroom", "fungi")).toBe(true);
  });

  it("arranges all six kingdom trays in two neat rows of three", () => {
    expect(KINGDOMS).toHaveLength(6);
    expect(kingdomTrayPosition(0)).toEqual([-1.12, 0, 0.35]);
    expect(kingdomTrayPosition(1)).toEqual([0, 0, 0.35]);
    expect(kingdomTrayPosition(5)[2]).toBeGreaterThan(
      kingdomTrayPosition(0)[2]
    );
  });
});
