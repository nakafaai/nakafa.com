import {
  getOnboardingDestination,
  getOnboardingRegionDefaults,
} from "@repo/backend/convex/onboarding/spec";
import { describe, expect, it } from "vitest";

describe("onboarding product defaults", () => {
  it.each([
    ["indonesia", { curriculumProgramKey: "merdeka", locale: "id" }],
    ["singapore", { curriculumProgramKey: "singapore-moe", locale: "en" }],
    [
      "united-kingdom",
      { curriculumProgramKey: "cambridge-international", locale: "en" },
    ],
    [
      "germany",
      { curriculumProgramKey: "cambridge-international", locale: "de" },
    ],
    ["united-states", { curriculumProgramKey: "united-states", locale: "en" }],
    [
      "international",
      { curriculumProgramKey: "cambridge-international", locale: "en" },
    ],
  ] as const)("maps %s to its locale and curriculum", (region, expected) => {
    expect(getOnboardingRegionDefaults(region)).toEqual(expected);
  });

  it("keeps tryout independent from the selected region curriculum", () => {
    expect(
      getOnboardingDestination({
        focus: "tryout",
        publicSlug: "cambridge-international",
      })
    ).toEqual({ kind: "tryout" });
  });
});
