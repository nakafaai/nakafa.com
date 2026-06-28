import { describe, expect, it } from "vitest";
import { getOnboardingChoiceGridColumns } from "@/components/programs/onboarding/styles";

describe("onboarding styles", () => {
  it("centers a single filtered choice instead of leaving an empty second column", () => {
    expect(getOnboardingChoiceGridColumns(0)).toBe("one");
    expect(getOnboardingChoiceGridColumns(1)).toBe("one");
    expect(getOnboardingChoiceGridColumns(2)).toBe("two");
    expect(getOnboardingChoiceGridColumns(3)).toBe("three");
  });
});
