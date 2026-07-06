"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { TryoutQuestionMarkdown } from "@/components/tryout/question-markdown";

type SectionRuntime = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.attempt.getSectionRuntime>
>;
type RuntimeQuestion = SectionRuntime["questions"][number];

/** Renders the active Convex-backed try-out section runtime. */
export function TryoutRuntime({ runtime }: { runtime: SectionRuntime }) {
  return (
    <section className="space-y-4">
      {runtime.questions.map((question) => (
        <TryoutRuntimeQuestion
          key={question.placementId}
          question={question}
          sectionStartedAt={runtime.section.startedAt}
        />
      ))}
    </section>
  );
}

/** Renders one question and saves choice selections through Convex. */
function TryoutRuntimeQuestion({
  question,
  sectionStartedAt,
}: {
  question: RuntimeQuestion;
  sectionStartedAt: number;
}) {
  const saveResponse = useMutation(api.tryouts.mutations.attempts.saveResponse);
  const tExercises = useTranslations("Exercises");
  const [isPending, startTransition] = useTransition();

  function saveChoice(optionKey: string) {
    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: () =>
            saveResponse({
              placementId: question.placementId,
              selectedOptionId: optionKey,
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
    });
  }

  return (
    <article className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="space-y-3">
        <div className="font-medium text-muted-foreground text-sm">
          {tExercises("number-count", { count: question.questionOrder })}
        </div>
        <TryoutQuestionMarkdown
          body={question.questionBody}
          id={question.questionId}
        />
      </div>

      <div className="grid gap-2">
        {question.choices.map((choice) => {
          const isSelected =
            question.response?.selectedOptionId === choice.optionKey;

          return (
            <Button
              aria-pressed={isSelected}
              className={cn(
                "h-auto justify-start whitespace-normal px-4 py-3 text-left",
                isSelected && "border-primary bg-primary/10 text-foreground"
              )}
              disabled={isPending}
              key={choice.optionKey}
              onClick={() => saveChoice(choice.optionKey)}
              type="button"
              variant={isSelected ? "outline" : "ghost"}
            >
              <span className="font-medium">{getChoiceMarker(choice)}.</span>
              <span>{choice.label}</span>
            </Button>
          );
        })}
      </div>
    </article>
  );
}

function getElapsedSeconds(startedAt: number) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function getChoiceMarker(choice: RuntimeQuestion["choices"][number]) {
  if (choice.order < 1 || choice.order > 26) {
    return choice.optionKey;
  }

  return String.fromCharCode(64 + choice.order);
}
