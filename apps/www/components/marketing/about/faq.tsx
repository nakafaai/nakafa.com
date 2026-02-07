import { Mail01Icon, UserQuestion02Icon } from "@hugeicons/core-free-icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

export function Faq() {
  const t = useTranslations("Faq");

  const faqs = [
    { question: t("q1"), answer: t("a1") },
    { question: t("q2"), answer: t("a2") },
    { question: t("q3"), answer: t("a3") },
    { question: t("q4"), answer: t("a4") },
    { question: t("q5"), answer: t("a5") },
    { question: t("q6"), answer: t("a6") },
    { question: t("q7"), answer: t("a7") },
  ];

  return (
    <section className="border-b">
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="scroll-mt-28 px-6 py-24" id="faq">
          <div className="grid gap-12 lg:grid-cols-3 lg:gap-12">
            <div className="grid content-start gap-6 lg:col-span-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
                  <HugeIcons className="size-4" icon={UserQuestion02Icon} />
                  {t("badge")}
                </span>
              </div>

              <h2 className="max-w-sm text-balance font-medium text-3xl tracking-tight sm:text-4xl">
                {t.rich("headline", {
                  mark: (chunks) => <mark>{chunks}</mark>,
                })}
              </h2>

              <p className="max-w-sm text-pretty text-lg text-muted-foreground">
                {t("description")}
              </p>

              <Button
                className="w-fit"
                nativeButton={false}
                render={
                  <a
                    href="mailto:nakafaai@gmail.com"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <HugeIcons icon={Mail01Icon} />
                    {t("cta-contact")}
                  </a>
                }
              />
            </div>

            <div className="lg:col-span-2">
              <Accordion className="w-full" type="single">
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
