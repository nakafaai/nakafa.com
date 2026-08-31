import { describe, expect, it } from "vitest";
import {
  applyOnboardingAnswer,
  getCompleteOnboardingAnswers,
  getInitialOnboardingItem,
  getOnboardingAnswer,
  getOnboardingAnswers,
} from "@/components/programs/onboarding/state";

describe("onboarding state", () => {
  it("resumes at the first unanswered question", () => {
    expect(getInitialOnboardingItem({})).toBe("role");
    expect(getInitialOnboardingItem({ role: "student" })).toBe("region");
    expect(
      getInitialOnboardingItem({ role: "student", region: "indonesia" })
    ).toBe("focus");
  });

  it("initializes only answers owned by a saved profile", () => {
    expect(getOnboardingAnswers(null)).toEqual({});
    expect(getOnboardingAnswers({ updatedAt: 9 })).toEqual({});
    expect(
      getOnboardingAnswers({
        focus: "learning",
        region: "international",
        role: "teacher",
        updatedAt: 10,
      })
    ).toEqual({
      focus: "learning",
      region: "international",
      role: "teacher",
    });
  });

  it("builds the discriminated answer for the active item", () => {
    const answers = {
      focus: "tryout" as const,
      region: "singapore" as const,
      role: "parent" as const,
    };
    expect(getOnboardingAnswer("role", answers)).toEqual({
      kind: "role",
      value: "parent",
    });
    expect(getOnboardingAnswer("region", answers)).toEqual({
      kind: "region",
      value: "singapore",
    });
    expect(getOnboardingAnswer("focus", answers)).toEqual({
      kind: "focus",
      value: "tryout",
    });
    expect(getOnboardingAnswer("role", {})).toBeNull();
    expect(getOnboardingAnswer("region", {})).toBeNull();
    expect(getOnboardingAnswer("focus", {})).toBeNull();
  });

  it("requires all three answers before building the atomic Finish input", () => {
    expect(
      getCompleteOnboardingAnswers({ role: "student", region: "indonesia" })
    ).toBeNull();
    expect(
      getCompleteOnboardingAnswers({
        focus: "learning",
        role: "student",
      })
    ).toBeNull();
    expect(
      getCompleteOnboardingAnswers({
        focus: "learning",
        region: "indonesia",
      })
    ).toBeNull();
    expect(
      getCompleteOnboardingAnswers({
        focus: "learning",
        region: "international",
        role: "student",
      })
    ).toEqual({
      focus: "learning",
      region: "international",
      role: "student",
    });
  });

  it("applies one optimistic answer without dropping other draft fields", () => {
    expect(
      applyOnboardingAnswer(
        { region: "indonesia", role: "student", updatedAt: 1 },
        { kind: "focus", value: "tryout" },
        2
      )
    ).toEqual({
      focus: "tryout",
      region: "indonesia",
      role: "student",
      updatedAt: 2,
    });
    expect(
      applyOnboardingAnswer(null, { kind: "role", value: "parent" }, 3)
    ).toEqual({ role: "parent", updatedAt: 3 });
    expect(
      applyOnboardingAnswer(
        { role: "student", updatedAt: 3 },
        { kind: "region", value: "germany" },
        4
      )
    ).toEqual({ region: "germany", role: "student", updatedAt: 4 });
  });
});
