"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";
import type { MarketingFaqItem } from "@/components/marketing/about/faq/section";

export function FaqAccordion({ faqs }: { faqs: readonly MarketingFaqItem[] }) {
  return (
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
  );
}
