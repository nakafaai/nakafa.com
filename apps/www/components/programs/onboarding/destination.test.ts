import { describe, expect, it } from "@effect/vitest";
import { getOnboardingDestinationHref } from "@/components/programs/onboarding/destination";

describe("onboarding destination", () => {
  it("opens the localized curriculum root for learning focus", () => {
    expect(
      getOnboardingDestinationHref({
        destination: {
          kind: "curriculum-program",
          publicSlug: "singapore-moe",
        },
        locale: "en",
      })
    ).toBe("/curriculum/singapore-moe");
  });

  it("opens the localized curriculum index when no default exists", () => {
    expect(
      getOnboardingDestinationHref({
        destination: { kind: "curriculum-index" },
        locale: "de",
      })
    ).toBe("/lehrplaene");
  });

  it("opens the tryout hub for every region", () => {
    expect(
      getOnboardingDestinationHref({
        destination: { kind: "tryout" },
        locale: "en",
      })
    ).toBe("/try-out");
  });
});
