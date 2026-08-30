"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { lazy, Suspense } from "react";
import type { MarketingFaqItem } from "@/components/marketing/about/faq/section";

interface PricingQuestionsProps {
  faqs: readonly MarketingFaqItem[];
}

function ClosedQuestions({ faqs }: PricingQuestionsProps) {
  return (
    <div className="flex w-full flex-col">
      {faqs.map((faq) => (
        <div className="border-b last:border-b-0" key={faq.question}>
          <div className="flex">
            <div className="flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-base">
              {faq.question}
              <HugeIcons
                className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground"
                icon={ArrowDown01Icon}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const FaqAccordion = lazy(() =>
  import("@/components/marketing/about/faq/accordion.client").then(
    ({ FaqAccordion: Component }) => ({ default: Component })
  )
);

/** Keeps Accordion runtime out of unrelated route prefetches. */
export function DeferredAccordion({ faqs }: PricingQuestionsProps) {
  const mounted = useMounted();

  if (!mounted) {
    return <ClosedQuestions faqs={faqs} />;
  }

  return (
    <Suspense fallback={<ClosedQuestions faqs={faqs} />}>
      <FaqAccordion faqs={faqs} />
    </Suspense>
  );
}
