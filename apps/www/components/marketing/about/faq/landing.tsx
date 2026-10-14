import { useTranslations } from "next-intl";
import { FaqAccordion } from "@/components/marketing/about/faq/accordion.client";
import type { MarketingFaqItem } from "@/lib/marketing/faq";

/**
 * The questions of the home page as a plain list. Each question is one line
 * with a rule under it, and the first one is open. The questions are the ones
 * that no other part of the page answers.
 */
export function Faq({ faqs }: { faqs: readonly MarketingFaqItem[] }) {
  const t = useTranslations("Landing");

  return (
    <section className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32" id="faq">
      <div className="mx-auto grid w-full max-w-3xl gap-10">
        <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
          {t("faq-title")}
        </h2>
        <FaqAccordion faqs={faqs} openFirst />
      </div>
    </section>
  );
}
