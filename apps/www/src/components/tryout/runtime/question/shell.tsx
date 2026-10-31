"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Separator } from "@repo/design-system/components/ui/separator";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { readQuestionIds } from "@/components/player/ids";
import { PlayerQuestionHeader } from "@/components/player/question";

interface TryoutQuestionShellProps {
  readonly children: ReactNode;
  readonly questionOrder: number;
}

/** Composes one immutable review question with optional question actions. */
export function TryoutReviewQuestionShell({
  action,
  children,
  questionOrder,
}: TryoutQuestionShellProps & { readonly action?: ReactNode }) {
  const tPlayer = useTranslations("Player");
  const ids = readQuestionIds(questionOrder);

  return (
    <Collapsible>
      <article aria-labelledby={ids.title} id={ids.article}>
        <PlayerQuestionHeader number={questionOrder}>
          <ButtonGroup
            aria-label={tPlayer("question", { number: questionOrder })}
            className="shrink-0"
          >
            {action}
            <TryoutExplanationTrigger />
          </ButtonGroup>
        </PlayerQuestionHeader>
        {children}
      </article>
    </Collapsible>
  );
}

/** Composes one locked review question with its explanation area held open. */
export function TryoutLockedQuestionShell({
  children,
  questionOrder,
}: TryoutQuestionShellProps) {
  const ids = readQuestionIds(questionOrder);

  return (
    <Collapsible defaultOpen disabled>
      <article aria-labelledby={ids.title} id={ids.article}>
        <PlayerQuestionHeader number={questionOrder}>
          <TryoutExplanationTrigger />
        </PlayerQuestionHeader>
        {children}
      </article>
    </Collapsible>
  );
}

/** Renders authorized explanation content inside one review question. */
export function TryoutReviewQuestionExplanation({
  children,
  questionOrder,
}: TryoutQuestionShellProps) {
  const tTryouts = useTranslations("Tryouts");
  const explanationId = `question-${questionOrder}-explanation`;

  return (
    <CollapsiblePanel>
      <section aria-labelledby={explanationId} className="space-y-6 pb-8">
        <Separator />
        <h3 className="scroll-mt-44 text-lg font-medium" id={explanationId}>
          {tTryouts("explanation")}
        </h3>
        {children}
      </section>
    </CollapsiblePanel>
  );
}

/** Toggles the explanation; a disabled question disables it through its root. */
function TryoutExplanationTrigger() {
  const tTryouts = useTranslations("Tryouts");

  return (
    <CollapsibleTrigger
      className="group"
      render={<Button type="button" variant="outline" />}
    >
      {tTryouts("explanation")}
      <HugeIcons
        className="transition-transform ease-out group-data-[panel-open]:rotate-180"
        icon={ArrowDown01Icon}
      />
    </CollapsibleTrigger>
  );
}
