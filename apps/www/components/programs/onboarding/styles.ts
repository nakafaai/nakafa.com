import { cva } from "class-variance-authority";

export const onboardingChoiceGridVariants = cva(
  "grid w-full grid-cols-1 items-stretch justify-center gap-4",
  {
    variants: {
      columns: {
        one: "max-w-sm sm:grid-cols-1",
        two: "max-w-xl sm:grid-cols-2",
        three: "max-w-4xl sm:grid-cols-3",
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

export const onboardingChoiceCardVariants = cva(
  "flex h-full w-full cursor-pointer flex-col justify-between overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-colors ease-out hover:border-primary/50 hover:bg-[color-mix(in_oklch,var(--primary)_1%,var(--background))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      selected: {
        false: "",
        true: "border-primary/60 bg-[color-mix(in_oklch,var(--primary)_2%,var(--background))] ring-1 ring-primary/20",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);
