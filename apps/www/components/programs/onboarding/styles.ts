import { cva } from "class-variance-authority";

export const onboardingChoiceGridVariants = cva(
  "grid w-full grid-cols-1 items-stretch justify-center gap-4",
  {
    variants: {
      columns: {
        one: "max-w-sm sm:grid-cols-1",
        two: "max-w-xl sm:grid-cols-2",
        three: "max-w-3xl sm:grid-cols-3",
      },
    },
    defaultVariants: {
      columns: "two",
    },
  }
);

/** Selects the onboarding choice grid width so a filtered single-card state stays centered. */
export function getOnboardingChoiceGridColumns(optionCount: number) {
  if (optionCount <= 1) {
    return "one";
  }

  if (optionCount >= 3) {
    return "three";
  }

  return "two";
}
