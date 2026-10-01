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
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface TryoutQuestionShellProps {
  readonly children: ReactNode;
  readonly questionOrder: number;
}

/** Composes one active question without terminal-review behavior. */
export function TryoutActiveQuestionShell({
  children,
  questionOrder,
}: TryoutQuestionShellProps) {
  return (
    <Collapsible disabled>
      <TryoutQuestionArticle questionOrder={questionOrder}>
        <TryoutQuestionHeader questionOrder={questionOrder}>
          <TryoutExplanationTrigger />
        </TryoutQuestionHeader>
        {children}
      </TryoutQuestionArticle>
    </Collapsible>
  );
}

/** Composes one immutable review question with optional question actions. */
export function TryoutReviewQuestionShell({
  action,
  children,
  questionOrder,
}: TryoutQuestionShellProps & { readonly action?: ReactNode }) {
  const tExercises = useTranslations("Exercises");

  return (
    <Collapsible>
      <TryoutQuestionArticle questionOrder={questionOrder}>
        <TryoutQuestionHeader questionOrder={questionOrder}>
          <ButtonGroup
            aria-label={tExercises("number-count", { count: questionOrder })}
            className="shrink-0"
          >
            {action}
            <TryoutExplanationTrigger />
          </ButtonGroup>
        </TryoutQuestionHeader>
        {children}
      </TryoutQuestionArticle>
    </Collapsible>
  );
}

/** Composes one locked review question with its explanation area held open. */
export function TryoutLockedQuestionShell({
  children,
  questionOrder,
}: TryoutQuestionShellProps) {
  return (
    <Collapsible defaultOpen disabled>
      <TryoutQuestionArticle questionOrder={questionOrder}>
        <TryoutQuestionHeader questionOrder={questionOrder}>
          <TryoutExplanationTrigger />
        </TryoutQuestionHeader>
        {children}
      </TryoutQuestionArticle>
    </Collapsible>
  );
}

/** Renders authorized explanation content inside one review question. */
export function TryoutReviewQuestionExplanation({
  children,
  questionOrder,
}: TryoutQuestionShellProps) {
  const tExercises = useTranslations("Exercises");
  const explanationId = `question-${questionOrder}-explanation`;

  return (
    <CollapsiblePanel>
      <section aria-labelledby={explanationId} className="space-y-6 pb-8">
        <Separator />
        <h3 className="scroll-mt-44 font-medium text-lg" id={explanationId}>
          {tExercises("explanation")}
        </h3>
        {children}
      </section>
    </CollapsiblePanel>
  );
}

/** Owns the stable article identity shared by both explicit variants. */
function TryoutQuestionArticle({
  children,
  questionOrder,
}: TryoutQuestionShellProps) {
  const id = `question-${questionOrder}`;

  return (
    <article aria-labelledby={`${id}-title`} id={`exercise-${id}`}>
      {children}
    </article>
  );
}

/** Composes the stable question anchor with a variant-owned action. */
export function TryoutQuestionHeader({
  children,
  questionOrder,
}: TryoutQuestionShellProps) {
  const tExercises = useTranslations("Exercises");
  const id = `question-${questionOrder}`;

  return (
    <div className="@container flex items-center gap-4">
      <a
        className="flex w-full flex-1 shrink-0 scroll-mt-44 outline-none ring-0"
        href={`#${id}`}
        id={id}
      >
        <div className="flex size-9 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
          <span className="font-mono text-xs tracking-tighter">
            {questionOrder}
          </span>
          <h2 className="sr-only" id={`${id}-title`}>
            {tExercises("number-count", { count: questionOrder })}
          </h2>
        </div>
      </a>
      {children}
    </div>
  );
}

/** Toggles the explanation; a disabled question disables it through its root. */
function TryoutExplanationTrigger() {
  const tExercises = useTranslations("Exercises");

  return (
    <CollapsibleTrigger
      className="group"
      render={<Button type="button" variant="outline" />}
    >
      {tExercises("explanation")}
      <HugeIcons
        className="transition-transform ease-out group-data-[panel-open]:rotate-180"
        icon={ArrowDown01Icon}
      />
    </CollapsibleTrigger>
  );
}
