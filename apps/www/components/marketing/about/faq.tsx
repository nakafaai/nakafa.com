import { Mail01Icon, UserQuestion02Icon } from "@hugeicons/core-free-icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export interface MarketingFaqItem {
  answer: string;
  question: string;
}

interface MarketingFaqSectionProps {
  badge: string;
  contactLabel: string;
  description?: string;
  faqs: readonly MarketingFaqItem[];
  headline: ReactNode;
  variant: "landing" | "page";
}

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
    <MarketingFaqSection
      badge={t("badge")}
      contactLabel={t("cta-contact")}
      description={t("description")}
      faqs={faqs}
      headline={t.rich("headline", {
        mark: (chunks) => <mark>{chunks}</mark>,
      })}
      variant="landing"
    />
  );
}

/** Renders pricing questions through the same FAQ surface as the homepage. */
export function PricingPageFaq({
  faqs,
}: {
  faqs: readonly MarketingFaqItem[];
}) {
  const t = useTranslations("PricingPage");

  return (
    <MarketingFaqSection
      badge={t("faq-badge")}
      contactLabel={t("faq-contact")}
      faqs={faqs}
      headline={t.rich("faq-headline", {
        mark: (chunks) => <mark>{chunks}</mark>,
      })}
      variant="page"
    />
  );
}

/** Owns the shared marketing FAQ layout and interaction pattern. */
function MarketingFaqSection({
  badge,
  contactLabel,
  description,
  faqs,
  headline,
  variant,
}: MarketingFaqSectionProps) {
  const spacingClassName =
    variant === "landing"
      ? "px-6 py-48 lg:px-10"
      : "px-6 py-24 sm:py-28 lg:px-10 lg:py-32";

  return (
    <section className={variant === "landing" ? "border-b" : undefined}>
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className={`scroll-mt-28 ${spacingClassName}`} id="faq">
          <div className="grid gap-12 lg:grid-cols-3">
            <div className="grid content-start gap-6 lg:col-span-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
                  <HugeIcons className="size-4" icon={UserQuestion02Icon} />
                  {badge}
                </span>
              </div>

              <h2 className="max-w-sm text-balance text-3xl tracking-tight sm:text-4xl">
                {headline}
              </h2>

              {description ? (
                <p className="max-w-sm text-pretty text-lg text-muted-foreground">
                  {description}
                </p>
              ) : null}

              <Button
                className="w-fit"
                nativeButton={false}
                render={
                  <a
                    href={`mailto:${COMPANY_IDENTITY.email}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <HugeIcons icon={Mail01Icon} />
                    {contactLabel}
                  </a>
                }
              />
            </div>

            <div className="lg:col-span-2">
              <Accordion className="w-full">
                {faqs.map((faq) => (
                  <AccordionItem key={faq.question} value={faq.question}>
                    <AccordionTrigger className="text-base transition-colors ease-out hover:text-primary hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-base text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
