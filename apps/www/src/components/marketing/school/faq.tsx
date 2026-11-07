import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { MarketingSection } from "@/components/marketing/shared/section";

/** The questions of a School page under the School's own title. The page gives the list. */
export function SchoolFaq({ children }: { children: ReactNode }) {
  const t = useTranslations("SchoolSite");

  return (
    <MarketingSection id="faq" labelledBy="school-faq-title">
      <div className="mx-auto grid w-full max-w-2xl gap-10">
        <h2
          className="text-center text-3xl tracking-tight text-balance sm:text-4xl"
          id="school-faq-title"
        >
          {t("faq-title")}
        </h2>
        {children}
      </div>
    </MarketingSection>
  );
}
