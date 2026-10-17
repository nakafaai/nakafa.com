import { useTranslations } from "next-intl";
import { MemoryDesk } from "@/components/marketing/about/memory/desk.client";

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
    <section className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32" id="memory">
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
    </section>
  );
}
