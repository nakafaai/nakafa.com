import { cn } from "@repo/design-system/lib/utils";
import { ONBOARDING_STEPS, type OnboardingStep } from "./model";

/** Renders compact progress dots for the three-step onboarding flow. */
export function ProgressDots({
  label,
  step,
}: {
  label: string;
  step: OnboardingStep;
}) {
  return (
    <ol
      aria-label={label}
      className="mx-auto flex items-center justify-center gap-2"
    >
      {ONBOARDING_STEPS.map((candidate) => (
        <li
          aria-hidden="true"
          className={cn(
            "block size-2 rounded-full bg-muted-foreground/30 transition-all",
            candidate === step && "h-2 w-7 bg-foreground"
          )}
          key={candidate}
        />
      ))}
    </ol>
  );
}
