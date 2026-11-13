import { useTranslations } from "use-intl";
import { TryoutReviewCheckout } from "@/components/tryout/review/upgrade";

/**
 * What a question's explanation shows a reader who may not read it: that its solution comes with Pro, and
 * the checkout that opens it. The reader sees every question and how each went; only the keys and the
 * explanations past the section's free samples wait for Pro.
 */
export function TryoutExplanationOffer() {
  const t = useTranslations("Tryouts");

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-muted-foreground text-sm">
        {t("paywall-description")}
      </p>
      <TryoutReviewCheckout />
    </div>
  );
}
