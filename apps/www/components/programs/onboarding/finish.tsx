import { PartyIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import type { useTranslations } from "next-intl";

type Translator = ReturnType<typeof useTranslations>;

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
