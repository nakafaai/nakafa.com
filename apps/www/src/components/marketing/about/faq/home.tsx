import { FaqAccordion } from "@/components/marketing/about/faq/accordion";
import { Faq } from "@/components/marketing/about/faq/landing";
import type { MarketingFaqItem } from "@/lib/marketing/faq";

/** The questions part of the home page, the first one open. */
export function HomeFaq({ faqs }: { faqs: readonly MarketingFaqItem[] }) {
  return (
    <Faq>
      <FaqAccordion faqs={faqs} openFirst />
    </Faq>
  );
}
