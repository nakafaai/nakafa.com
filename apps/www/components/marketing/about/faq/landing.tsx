import { useTranslations } from "next-intl";
import { FaqAccordion } from "@/components/marketing/about/faq/accordion.client";
import { FaqSection } from "@/components/marketing/about/faq/section";
import type { MarketingFaqItem } from "@/lib/marketing/faq";

/** Renders the landing FAQ frame around the route-owned question list. */
export function Faq({ faqs }: { faqs: readonly MarketingFaqItem[] }) {
  const t = useTranslations("Faq");

  return (
    <section className="border-b">
      <FaqSection
        badge={t("badge")}
        className="py-48"
        contactLabel={t("cta-contact")}
        description={t("description")}
        headline={t.rich("headline", {
          mark: (chunks) => <mark>{chunks}</mark>,
        })}
      >
        <FaqAccordion faqs={faqs} />
      </FaqSection>
    </section>
  );
}
