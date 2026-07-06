"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Response } from "@repo/design-system/components/ai/response";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Label } from "@repo/design-system/components/ui/label";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";
import type {
  TryoutRuntimeQuestion as RuntimeQuestion,
  TryoutRuntimeChoice,
  TryoutSectionRuntime,
  TryoutSectionRuntimeArgs,
} from "@/components/tryout/types";

interface TryoutRuntimeQuestionProps {
  content: ReactNode;
  isExpired: boolean;
  question: RuntimeQuestion;
  runtime: TryoutSectionRuntime;
  runtimeQueryArgs: TryoutSectionRuntimeArgs;
  sectionStartedAt: number;
}

/** Renders one question with the original production exercise answer styling. */
export function TryoutRuntimeQuestion({
  content,
  isExpired,
  question,
  runtime,
  runtimeQueryArgs,
  sectionStartedAt,
}: TryoutRuntimeQuestionProps) {
  const tExercises = useTranslations("Exercises");
  const id = `question-${question.questionOrder}`;

  return (
    <article
      aria-labelledby={`${id}-title`}
      className="content-auto-exercise"
      id={`exercise-${id}`}
    >
      <div className="flex items-center gap-4">
        <a
          className="flex w-full flex-1 shrink-0 scroll-mt-44 outline-none ring-0"
          href={`#${id}`}
          id={id}
        >
          <div className="flex size-9 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
            <span className="font-mono text-xs tracking-tighter">
              {question.questionOrder}
            </span>
            <h2 className="sr-only" id={`${id}-title`}>
              {tExercises("number-count", { count: question.questionOrder })}
            </h2>
          </div>
        </a>

        <Button disabled type="button" variant="outline">
          {tExercises("explanation")}
          <HugeIcons
            className="transition-transform ease-out"
            icon={ArrowDown01Icon}
          />
        </Button>
      </div>

      {content ? <section className="my-6">{content}</section> : null}

      <section className="my-8">
        <TryoutChoices
          isExpired={isExpired}
          question={question}
          runtime={runtime}
          runtimeQueryArgs={runtimeQueryArgs}
          sectionStartedAt={sectionStartedAt}
        />
      </section>
    </article>
  );
}

/** Renders and saves selectable answers for one runtime question. */
function TryoutChoices({
  isExpired,
  question,
  runtime,
  runtimeQueryArgs,
  sectionStartedAt,
}: {
  isExpired: boolean;
  question: RuntimeQuestion;
  runtime: TryoutSectionRuntime;
  runtimeQueryArgs: TryoutSectionRuntimeArgs;
  sectionStartedAt: number;
}) {
  const saveResponse = useMutation(
    api.tryouts.mutations.attempts.saveResponse
  ).withOptimisticUpdate((localStore, args) => {
    if (!args.selectedOptionId) {
      return;
    }

    const currentRuntime =
      localStore.getQuery(
        api.tryouts.queries.attempt.getSectionRuntime,
        runtimeQueryArgs
      ) ?? runtime;

    const selectedAt = currentRuntime.section.startedAt + args.timeSpent * 1000;
    let foundQuestion = false;
    let answeredFirstTime = false;
    const questions = currentRuntime.questions.map((runtimeQuestion) => {
      if (runtimeQuestion.placementId !== args.placementId) {
        return runtimeQuestion;
      }

      foundQuestion = true;

      if (!runtimeQuestion.response) {
        answeredFirstTime = true;
      }

      return {
        ...runtimeQuestion,
        response: {
          answeredAt: runtimeQuestion.response?.answeredAt ?? selectedAt,
          selectedOptionId: args.selectedOptionId,
          updatedAt: selectedAt,
        },
      };
    });

    if (!foundQuestion) {
      return;
    }

    const answeredCount = answeredFirstTime
      ? Math.min(
          currentRuntime.section.totalQuestions,
          currentRuntime.section.answeredCount + 1
        )
      : currentRuntime.section.answeredCount;

    localStore.setQuery(
      api.tryouts.queries.attempt.getSectionRuntime,
      runtimeQueryArgs,
      {
        ...currentRuntime,
        questions,
        section: {
          ...currentRuntime.section,
          answeredCount,
        },
      }
    );
  });
  const tExercises = useTranslations("Exercises");

  /** Saves one selected choice through Convex with elapsed section time. */
  function saveChoice(choice: TryoutRuntimeChoice) {
    if (isExpired) {
      return;
    }

    Effect.runPromise(
      Effect.tryPromise({
        try: () =>
          saveResponse({
            placementId: question.placementId,
            selectedOptionId: choice.optionKey,
            timeSpent: getElapsedSeconds(sectionStartedAt),
          }),
        catch: (cause) => cause,
      }).pipe(
        Effect.catchAll(() =>
          Effect.sync(() => {
            toast.error(tExercises("submit-answer-error"), {
              position: "bottom-center",
            });
          })
        )
      )
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {question.choices.map((choice) => (
        <TryoutChoice
          choice={choice}
          disabled={isExpired}
          key={choice.optionKey}
          onSelect={() => saveChoice(choice)}
          question={question}
        />
      ))}
    </div>
  );
}

/** Renders one selectable answer option in the production exercise style. */
function TryoutChoice({
  choice,
  disabled,
  onSelect,
  question,
}: {
  choice: TryoutRuntimeChoice;
  disabled: boolean;
  onSelect: () => void;
  question: RuntimeQuestion;
}) {
  const checked = question.response?.selectedOptionId === choice.optionKey;

  return (
    <Label
      className={cn(
        buttonVariants({
          variant: checked ? "default-outline" : "outline",
        }),
        "h-auto min-w-0 whitespace-normal text-left font-normal text-base"
      )}
    >
      <Checkbox
        checked={checked}
        className="mt-1 shrink-0 cursor-pointer"
        disabled={disabled}
        onCheckedChange={(nextChecked) => {
          if (nextChecked) {
            onSelect();
          }
        }}
      />
      <Response
        className="wrap-anywhere h-auto min-w-0 flex-1 whitespace-normal"
        id={`${question.questionId}-${choice.optionKey}`}
      >
        {choice.label}
      </Response>
    </Label>
  );
}

/** Calculates elapsed whole seconds since a Convex section start timestamp. */
function getElapsedSeconds(startedAt: number) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}
