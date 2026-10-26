import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { MarketingSection } from "@/components/marketing/shared/section";

/**
 * The questions of a marketing page as a plain list, on the home page and the
 * pricing page. Each question is one line with a rule under it, and the first
 * one is open. The questions are the ones that no other part of the page answers.
 */
export function Faq({ children }: { children: ReactNode }) {
  const t = useTranslations("Landing");

  return (
    <MarketingSection id="faq">
      <div className="mx-auto grid w-full max-w-2xl gap-10">
        <h2 className="text-balance text-center text-3xl tracking-tight sm:text-4xl">
          {t("faq-title")}
        </h2>
        {children}
      </div>
    </MarketingSection>
  );
}
