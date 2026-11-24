// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  stepsForRoute,
  waypointOf,
} from "@repo/design-system/components/contents/biology/secretion/model";

describe("enzyme secretion lab model", () => {
  it("lists exact stage sequences for intracellular and extracellular routes", () => {
    expect(stepsForRoute("intracellular")).toEqual([
      "nucleus",
      "freeRibosome",
      "cytoplasm",
    ]);
    expect(stepsForRoute("extracellular")).toEqual([
      "nucleus",
      "boundRibosome",
      "reticulum",
      "transport",
      "golgi",
      "secretory",
      "exocytosis",
    ]);
  });

  it("progresses spatial waypoints from nucleus toward the apical duct", () => {
    expect(waypointOf("nucleus")[0]).toBeLessThan(waypointOf("reticulum")[0]);
    expect(waypointOf("reticulum")[0]).toBeLessThan(waypointOf("golgi")[0]);
    expect(waypointOf("golgi")[0]).toBeLessThan(waypointOf("exocytosis")[0]);
  });
});
