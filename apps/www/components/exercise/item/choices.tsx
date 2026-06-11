"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";
import { Response } from "@repo/design-system/components/ai/response";
import type { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import { toastManager } from "@repo/design-system/components/ui/toast";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { type ComponentProps, useTransition } from "react";
import { reportClientException } from "@/lib/analytics/client";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";

/** Renders the selectable choices for one exercise and submits answers to Convex. */
export function ExerciseChoices({
  choices,
  exerciseNumber,
  id,
}: {
  choices: ExercisesChoices[keyof ExercisesChoices];
  exerciseNumber: number;
  id: string;
}) {
  const t = useTranslations("Exercises");
  const [isPending, startTransition] = useTransition();

  const attemptId = useAttempt((state) => state.attemptId);
  const attemptMode = useAttempt((state) => state.attemptMode);
  const attemptStatus = useAttempt((state) => state.attemptStatus);
  const currentAnswer = useAttempt(
    (state) => state.answerByExercise.get(exerciseNumber) ?? null
  );
  const answerSheetEntry = useAttempt(
    (state) => state.answerSheetByExercise.get(exerciseNumber) ?? null
  );
  const isInputLocked = useAttempt((state) => state.isInputLocked);
  const isReviewMode = useAttempt((state) => state.isReviewMode);
  const submitAttempt = useMutation(api.exercises.mutations.submitAnswer);
  const timeSpent = useExercise(
    (state) => state.timeSpent[exerciseNumber] ?? 0
  );

  /** Submits one selected option for the current exercise. */
  function handleSubmit(index: number) {
    if (!attemptId) {
      toastManager.add({ type: "info", title: t("attempt-not-found") });
      return;
    }

    if (isInputLocked) {
      toastManager.add({ type: "info", title: t("attempt-expiry-processing") });
      return;
    }

    if (attemptStatus !== "in-progress") {
      toastManager.add({ type: "info", title: t("attempt-not-in-progress") });
      return;
    }

    const option = answerSheetEntry?.options[index];

    if (!(answerSheetEntry && option)) {
      toastManager.add({
        type: "error",
        title: "Question metadata unavailable.",
      });
      return;
    }

    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: () =>
            submitAttempt({
              attemptId,
              exerciseNumber,
              questionId: answerSheetEntry.questionId,
              selectedOptionId: option.optionKey,
              timeSpent,
            }),
          catch: (error) => error,
        }).pipe(
          Effect.catchAll((error) => {
            if (!(error instanceof ConvexError)) {
              return reportClientException(error, {
                source: "exercise-submit-answer",
              }).pipe(
                Effect.zipRight(
                  Effect.sync(() => {
                    toastManager.add({
                      type: "error",
                      title: t("submit-answer-error"),
                    });
                  })
                )
              );
            }

            const errorData = error.data;

            if (!(typeof errorData === "object" && errorData !== null)) {
              return reportClientException(error, {
                source: "exercise-submit-answer",
              }).pipe(
                Effect.zipRight(
                  Effect.sync(() => {
                    toastManager.add({
                      type: "error",
                      title: t("submit-answer-error"),
                    });
                  })
                )
              );
            }

            const errorCode = "code" in errorData ? errorData.code : undefined;

            if (
              errorCode === "TIME_EXPIRED" ||
              errorCode === "TRYOUT_EXPIRED"
            ) {
              return Effect.sync(() => {
                toastManager.add({
                  type: "info",
                  title: t("attempt-expiry-processing"),
                });
              });
            }

            if (errorCode === "INVALID_ATTEMPT_STATUS") {
              return Effect.sync(() => {
                toastManager.add({
                  type: "info",
                  title: t("attempt-not-in-progress"),
                });
              });
            }

            return reportClientException(error, {
              ...(typeof errorCode === "string"
                ? { convex_error_code: errorCode }
                : {}),
              source: "exercise-submit-answer",
            }).pipe(
              Effect.zipRight(
                Effect.sync(() => {
                  toastManager.add({
                    type: "error",
                    title: t("submit-answer-error"),
                  });
                })
              )
            );
          })
        )
      );
    });
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {choices.map((choice, index) => {
        let variant: ComponentProps<typeof Button>["variant"] = "outline";
        let isPrimaryState = false;
        const optionKey = answerSheetEntry?.options[index]?.optionKey;

        const checked =
          (optionKey !== undefined &&
            currentAnswer?.selectedOptionId === optionKey) ||
          currentAnswer?.textAnswer === choice.label;

        if (checked) {
          isPrimaryState = true;
        }

        const shouldShowReviewState =
          isReviewMode ||
          attemptMode === "practice" ||
          attemptStatus === "completed" ||
          attemptStatus === "expired";

        if (shouldShowReviewState) {
          if (checked && currentAnswer && !currentAnswer.isCorrect) {
            variant = "destructive-outline";
            isPrimaryState = false;
          }

          if (choice.value) {
            isPrimaryState = true;
          }
        }

        return (
          <Label
            className={cn(
              buttonVariants({ variant }),
              isPrimaryState &&
                "border-primary/40 bg-primary/8 text-primary hover:bg-primary/12",
              "h-auto min-w-0 whitespace-normal text-left font-normal text-base"
            )}
            key={choice.label}
          >
            <Checkbox
              checked={checked}
              className="mt-1 shrink-0 cursor-pointer"
              disabled={isInputLocked || isPending}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleSubmit(index);
                }
              }}
            />
            <Response
              className="wrap-anywhere h-auto min-w-0 flex-1 whitespace-normal"
              id={`${id}-${choice.label}`}
            >
              {choice.label}
            </Response>
          </Label>
        );
      })}
    </div>
  );
}
