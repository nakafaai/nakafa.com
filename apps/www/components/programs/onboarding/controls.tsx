import { PartyIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import type { useTranslations } from "next-intl";
import { ONBOARDING_STEPS, type OnboardingStep } from "./model";

type Translator = ReturnType<typeof useTranslations>;

/** Renders Back and Skip controls for non-submit onboarding steps. */
export function ChoiceControls({
  canSkip,
  canContinue,
  onBack,
  onContinue,
  onSkip,
  step,
  t,
}: {
  canSkip: boolean;
  canContinue: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
  step: Exclude<OnboardingStep, "confirm">;
  t: Translator;
}) {
  return (
    <div className="flex items-center gap-4">
      {step === "interests" ? null : (
        <Button className="h-11" onClick={onBack} type="button" variant="ghost">
          {t("onboarding.back")}
        </Button>
      )}
      {step === "interests" ? (
        <Button
          className="h-11"
          disabled={!canContinue}
          onClick={onContinue}
          type="button"
        >
          {t("onboarding.continue")}
        </Button>
      ) : null}
      {canSkip ? (
        <Button className="h-11" onClick={onSkip} type="button" variant="ghost">
          {t("onboarding.skip")}
        </Button>
      ) : null}
    </div>
  );
}

/** Renders the final submit controls for saving the selected program. */
export function SubmitControls({
  isSubmitting,
  onBack,
  t,
}: {
  isSubmitting: boolean;
  onBack: () => void;
  t: Translator;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4">
      <Button className="h-11" disabled={isSubmitting} size="lg" type="submit">
        <Spinner
          data-icon="inline-start"
          icon={PartyIcon}
          isLoading={isSubmitting}
        />
        {t("onboarding.save-cta")}
      </Button>
      <Button className="h-11" onClick={onBack} type="button" variant="ghost">
        {t("onboarding.back")}
      </Button>
    </div>
  );
}

/** Renders compact progress dots for the three-step onboarding flow. */
export function ProgressDots({
  label,
  step,
}: {
  label: string;
  step: OnboardingStep;
}) {
  return (
    <div
      aria-label={label}
      className="mx-auto flex items-center justify-center gap-2"
      role="img"
    >
      {ONBOARDING_STEPS.map((candidate) => (
        <span
          aria-hidden="true"
          className={cn(
            "block size-2 rounded-full bg-muted-foreground/30 transition-all",
            candidate === step && "h-2 w-7 bg-foreground"
          )}
          key={candidate}
        />
      ))}
    </div>
  );
}
