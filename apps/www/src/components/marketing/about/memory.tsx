import { useTranslations } from "use-intl";
import { MemoryDesk } from "@/components/marketing/about/memory/desk";
import { MarketingSection } from "@/components/marketing/shared/section";

/**
 * The memory part: no window and no list. Nina writes down five things the
 * learner says, and the notebooks pile up beside her as the days pass.
 */
export function Memory() {
  const t = useTranslations("Landing");
  const facts = [
    { said: t("memory-said-1"), when: t("memory-when-day") },
    { said: t("memory-said-2"), when: t("memory-when-day") },
    { said: t("memory-said-3"), when: t("memory-when-week") },
    { said: t("memory-said-4"), when: t("memory-when-week") },
    { said: t("memory-said-5"), when: t("memory-when-month") },
  ];

  return (
    <MarketingSection id="memory">
      <div className="mx-auto grid w-full max-w-3xl justify-items-center gap-10 text-center">
        <div className="grid justify-items-center gap-3">
          <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
            {t("memory-title")}
          </h2>
          <p className="max-w-xl text-pretty text-base text-muted-foreground">
            {t("memory-lead")}
          </p>
        </div>
        <MemoryDesk facts={facts} />
      </div>
    </MarketingSection>
  );
}
