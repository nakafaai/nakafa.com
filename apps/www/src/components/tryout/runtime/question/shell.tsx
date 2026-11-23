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
import { PlayerQuestion } from "@/components/player/question";
import { isExplanationOpen } from "@/components/tryout/review/context";
import { useTryoutExplained } from "@/components/tryout/review/result";
import { scrollExplanationIntoView } from "@/components/tryout/review/scroll";

interface TryoutQuestionShellProps {
  readonly children: ReactNode;
  readonly questionOrder: number;
}

/**
 * Composes one finished question of the review's player, shown in the list or alone as the view decides, with
 * its explanation open as the review's store holds it, so its own button and the result's footer open and close
 * the same one. The caller composes its parts: the question's head (`PlayerQuestionHeader`, whose number shows
 * how it went, with `TryoutReviewQuestionActions`), its prompt, its answer and its explanation.
 */
export function TryoutReviewQuestionShell({
  children,
  questionKey,
  questionOrder,
}: TryoutQuestionShellProps & {
  /** The key that the player and the store name this question by. */
  readonly questionKey: string;
}) {
  const ids = readQuestionIds(questionOrder);
  const open = useTryoutExplained((state) =>
    isExplanationOpen(state, questionKey)
  );
  const toggle = useTryoutExplained((state) => state.toggle);

  return (
    <PlayerQuestion
      id={ids.article}
      labelledBy={ids.title}
      questionKey={questionKey}
    >
      <Collapsible
        onOpenChange={() => {
          if (toggle(questionKey)) {
            scrollExplanationIntoView(ids.explanation);
          }
        }}
        open={open}
      >
        {children}
      </Collapsible>
    </PlayerQuestion>
  );
}

/** A reviewed question's actions at the end of its head: what the caller adds, then the explanation's toggle. */
export function TryoutReviewQuestionActions({
  children,
  questionOrder,
}: {
  /** The actions before the explanation's toggle, such as asking Nina. */
  readonly children?: ReactNode;
  readonly questionOrder: number;
}) {
  const tCommon = useTranslations("Common");
  return (
    <ButtonGroup
      aria-label={tCommon("question", { number: questionOrder })}
      className="shrink-0"
    >
      {children}
      <TryoutExplanationTrigger />
    </ButtonGroup>
  );
}

/** Renders authorized explanation content inside one review question. */
export function TryoutReviewQuestionExplanation({
  children,
  questionOrder,
}: TryoutQuestionShellProps) {
  const tTryouts = useTranslations("Tryouts");
  const ids = readQuestionIds(questionOrder);

  return (
    <CollapsiblePanel>
      <section
        aria-label={tTryouts("explanation")}
        className="scroll-mt-44 space-y-6 pb-8"
        id={ids.explanation}
      >
        <Separator />
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
