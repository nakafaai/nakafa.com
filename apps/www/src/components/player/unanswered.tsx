import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

/**
 * Frames the numbers of the questions still open, so a learner can go back to
 * one before finishing. The page composes the grid of those numbers as its child.
 */
export function PlayerUnanswered({ children }: { children: ReactNode }) {
  const t = useTranslations("Player");

  return (
    <section className="grid gap-3">
      <h3 className="font-medium text-sm">{t("unanswered")}</h3>
      {children}
    </section>
  );
}
