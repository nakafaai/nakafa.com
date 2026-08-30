import { useTranslations } from "next-intl";
import { DeferredAccordion } from "@/components/marketing/about/faq/deferred.client";
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
        <DeferredAccordion faqs={faqs} />
      </FaqSection>
    </section>
  );
}
