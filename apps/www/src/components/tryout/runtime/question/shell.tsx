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
import { HashSet } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { readQuestionIds } from "@/components/player/ids";
import {
  PlayerQuestion,
  PlayerQuestionHeader,
} from "@/components/player/question";
import { useTryoutExplained } from "@/components/tryout/review/result";

interface TryoutQuestionShellProps {
  readonly children: ReactNode;
  readonly questionOrder: number;
}

/**
 * Composes one finished question of the review's player: its number, how it went, and its actions, shown in
 * the list or alone as the view decides, with its explanation open as the review's store holds it, so its
 * own button and the result's footer open and close the same one.
 */
export function TryoutReviewQuestionShell({
  action,
  children,
  mark,
  questionKey,
  questionOrder,
}: TryoutQuestionShellProps & {
  readonly action?: ReactNode;
  /** How the question went, beside its number. */
  readonly mark: ReactNode;
  /** The key that the player and the store name this question by. */
  readonly questionKey: string;
}) {
  const tPlayer = useTranslations("Player");
  const ids = readQuestionIds(questionOrder);
  const open = useTryoutExplained((state) =>
    HashSet.has(state.open, questionKey)
  );
  const toggle = useTryoutExplained((state) => state.toggle);

  return (
    <PlayerQuestion
      id={ids.article}
      labelledBy={ids.title}
      questionKey={questionKey}
    >
      <Collapsible onOpenChange={() => toggle(questionKey)} open={open}>
        <PlayerQuestionHeader number={questionOrder}>
          {mark}
          <ButtonGroup
            aria-label={tPlayer("question", { number: questionOrder })}
            className="shrink-0"
          >
            {action}
            <TryoutExplanationTrigger />
          </ButtonGroup>
        </PlayerQuestionHeader>
        {children}
      </Collapsible>
    </PlayerQuestion>
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
