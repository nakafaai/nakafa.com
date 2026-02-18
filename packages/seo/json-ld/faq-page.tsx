import type { Answer, FAQPage, Question, WithContext } from "schema-dts";
import { JsonLd } from ".";

interface FAQPageJsonLdProps {
  inLanguage: string;
  mainEntity: Pick<Question, "name" | "acceptedAnswer">[];
  url: string;
}

/**
 * FAQPageJsonLd component generates Schema.org FAQPage structured data
 * Used for Ask pages to enable FAQ rich results in Google Search
 *
 * @example
 * ```tsx
 * <FAQPageJsonLd
 *   url="/ask/how-to-learn-math"
 *   inLanguage="en"
 *   mainEntity={[
 *     {
 *       name: "How do I learn math?",
 *       acceptedAnswer: {
 *         "@type": "Answer",
 *         text: "Start with basic arithmetic and practice regularly."
 *       }
 *     }
 *   ]}
 * />
 * ```
 */
export function FAQPageJsonLd({
  mainEntity,
  url,
  inLanguage,
}: FAQPageJsonLdProps) {
  const faqItems: Question[] = mainEntity.map((item) => ({
    "@type": "Question",
    name: item.name,
    acceptedAnswer: item.acceptedAnswer as Answer,
  }));

  const faqPage: WithContext<FAQPage> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url,
    inLanguage,
    mainEntity: faqItems,
  };

  return <JsonLd jsonLd={faqPage} />;
}
