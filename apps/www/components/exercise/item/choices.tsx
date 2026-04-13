"use client";

import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";
import { Response } from "@repo/design-system/components/ai/response";
import type { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { type ComponentProps, useTransition } from "react";
import { toast } from "sonner";
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
      toast.info(t("attempt-not-found"), { position: "bottom-center" });
      return;
    }

    if (isInputLocked) {
      toast.info(t("attempt-expiry-processing"), {
        position: "bottom-center",
      });
      return;
    }

    if (attemptStatus !== "in-progress") {
      toast.info(t("attempt-not-in-progress"), { position: "bottom-center" });
      return;
    }

    const option = answerSheetEntry?.options[index];

    if (!(answerSheetEntry && option)) {
      toast.error("Question metadata unavailable.", {
        position: "bottom-center",
      });
      return;
    }

    startTransition(async () => {
      try {
        await submitAttempt({
          attemptId,
          exerciseNumber,
          questionId: answerSheetEntry.questionId,
          selectedOptionId: option.optionKey,
          timeSpent,
        });
      } catch (error) {
        if (!(error instanceof ConvexError)) {
          captureException(error, {
            source: "exercise-submit-answer",
          });

          toast.error(t("submit-answer-error"), {
            position: "bottom-center",
          });
          return;
        }

        const errorData = error.data;

        if (!(typeof errorData === "object" && errorData !== null)) {
          toast.error(t("submit-answer-error"), {
            position: "bottom-center",
          });
          return;
        }

        const errorCode = "code" in errorData ? errorData.code : undefined;

        if (errorCode === "TIME_EXPIRED" || errorCode === "TRYOUT_EXPIRED") {
          toast.info(t("attempt-expiry-processing"), {
            position: "bottom-center",
          });
          return;
        }

        if (errorCode === "INVALID_ATTEMPT_STATUS") {
          toast.info(t("attempt-not-in-progress"), {
            position: "bottom-center",
          });
          return;
        }

        captureException(error, {
          ...(typeof errorCode === "string"
            ? { convex_error_code: errorCode }
            : {}),
          source: "exercise-submit-answer",
        });

        toast.error(t("submit-answer-error"), {
          position: "bottom-center",
        });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {choices.map((choice, index) => {
        let variant: ComponentProps<typeof Button>["variant"] = "outline";
        const optionKey = answerSheetEntry?.options[index]?.optionKey;

        const checked =
          (optionKey !== undefined &&
            currentAnswer?.selectedOptionId === optionKey) ||
          currentAnswer?.textAnswer === choice.label;

        if (checked) {
          variant = "default-outline";
        }

        const shouldShowReviewState =
          isReviewMode ||
          attemptMode === "practice" ||
          attemptStatus === "completed" ||
          attemptStatus === "expired";

        if (shouldShowReviewState) {
          if (checked && currentAnswer && !currentAnswer.isCorrect) {
            variant = "destructive-outline";
          }

          if (choice.value) {
            variant = "default-outline";
          }
        }

        return (
          <Label
            className={cn(
              buttonVariants({ variant }),
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
