import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";
import { Array as Arr } from "effect";
import type { MarketingFaqItem } from "@/lib/marketing/faq";

/**
 * A list of questions where each answer opens on its own. With `openFirst`,
 * the first answer is open when the list first renders.
 */
export function FaqAccordion({
  faqs,
  openFirst = false,
}: {
  faqs: readonly MarketingFaqItem[];
  openFirst?: boolean;
}) {
  const questions = Arr.map(faqs, (faq) => faq.question);
  return (
    <Accordion
      className="w-full"
      defaultValue={openFirst ? Arr.take(questions, 1) : undefined}
    >
      {Arr.map(faqs, (faq) => (
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
