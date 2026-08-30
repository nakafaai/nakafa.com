import { useTranslations } from "next-intl";
import { FaqAccordion } from "@/components/marketing/about/faq/accordion.client";
import {
  FaqSection,
  type MarketingFaqItem,
} from "@/components/marketing/about/faq/section";

/** Renders dedicated pricing questions through the shared Accordion design. */
export function PricingPageFaq({
  faqs,
}: {
  faqs: readonly MarketingFaqItem[];
}) {
  const t = useTranslations("PricingPage");

  return (
    <section>
      <FaqSection
        badge={t("faq-badge")}
        className="py-24 sm:py-28 lg:py-32"
        contactLabel={t("faq-contact")}
        headline={t.rich("faq-headline", {
          mark: (chunks) => <mark>{chunks}</mark>,
        })}
      >
        <FaqAccordion faqs={faqs} />
      </FaqSection>
    </section>
  );
}
