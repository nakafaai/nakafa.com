import { describe, expect, it } from "@effect/vitest";
import { getOnboardingDestination } from "@/components/programs/onboarding/destination";
import { resolvePostAuthIntent } from "@/lib/auth/admission";

const NO_INTENT = resolvePostAuthIntent(undefined);

describe("onboarding destination", () => {
  it("opens the localized curriculum root for learning focus", () => {
    expect(
      getOnboardingDestination(
        {
          destination: {
            kind: "curriculum-program",
            publicSlug: "singapore-moe",
          },
          locale: "en",
        },
        NO_INTENT
      )
    ).toEqual({ href: "/curriculum/singapore-moe", locale: "en" });
  });

  it("opens the localized curriculum index when no default exists", () => {
    expect(
      getOnboardingDestination(
        {
          destination: { kind: "curriculum-index" },
          locale: "de",
        },
        NO_INTENT
      )
    ).toEqual({ href: "/lehrplaene", locale: "de" });
  });

  it("opens the tryout hub for every region", () => {
    expect(
      getOnboardingDestination(
        {
          destination: { kind: "tryout" },
          locale: "en",
        },
        NO_INTENT
      )
    ).toEqual({ href: "/try-out", locale: "en" });
  });

  it("resumes an explicit internal intent before the focus destination", () => {
    expect(
      getOnboardingDestination(
        {
          destination: { kind: "tryout" },
          locale: "de",
        },
        resolvePostAuthIntent("/id/search?q=geometry")
      )
    ).toEqual({ href: "/search?q=geometry", locale: "id" });
  });
});
