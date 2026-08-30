import { useTranslations } from "next-intl";
import { FaqAccordion } from "@/components/marketing/about/faq/accordion.client";
import { FaqSection } from "@/components/marketing/about/faq/section";

export function Faq() {
  const t = useTranslations("Faq");
  const faqs = [
    { question: t("q1"), answer: t("a1") },
    { question: t("q2"), answer: t("a2") },
    { question: t("q4"), answer: t("a4") },
    { question: t("q5"), answer: t("a5") },
    { question: t("q6"), answer: t("a6") },
    { question: t("q7"), answer: t("a7") },
  ];

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
