import { Button } from "@repo/design-system/components/ui/button";
import type { useTranslations } from "next-intl";
import type { OnboardingStep } from "./model";

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
