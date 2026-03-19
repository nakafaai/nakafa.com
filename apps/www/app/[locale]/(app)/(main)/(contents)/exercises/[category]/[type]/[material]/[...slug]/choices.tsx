"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";
import { Response } from "@repo/design-system/components/ai/response";
import {
  type Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { type ComponentProps, useTransition } from "react";
import { toast } from "sonner";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";

interface Props {
  choices: ExercisesChoices[keyof ExercisesChoices];
  exerciseNumber: number;
  id: string;
}

export function ExerciseChoices({ id, exerciseNumber, choices }: Props) {
  const t = useTranslations("Exercises");

  const [isPending, startTransition] = useTransition();

  const attempt = useAttempt((state) => state.attempt);
  const answers = useAttempt((state) => state.answers);
  const answerSheet = useAttempt((state) => state.answerSheet);
  const isInputLocked = useAttempt((state) => state.isInputLocked);

  const submitAttempt = useMutation(api.exercises.mutations.submitAnswer);
  const timeSpent = useExercise(
    (state) => state.timeSpent[exerciseNumber] ?? 0
  );

  const currentAnswer = answers.find(
    (a) => a.exerciseNumber === exerciseNumber
  );
  const answerSheetEntry = answerSheet.find(
    (entry) => entry.exerciseNumber === exerciseNumber
  );

  function handleSubmit({ index }: { index: number }) {
    if (!attempt) {
      toast.info(t("attempt-not-found"), { position: "bottom-center" });
      return;
    }

    if (isInputLocked) {
      toast.info(t("attempt-expiry-processing"), {
        position: "bottom-center",
      });
      return;
    }

    // If the attempt is not in progress, tell user to start new attempt
    if (attempt.status !== "in-progress") {
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
          attemptId: attempt._id,
          exerciseNumber,
          questionId: answerSheetEntry.questionId,
          selectedOptionId: option.optionKey,
          timeSpent,
        });
      } catch (error) {
        if (!(error instanceof ConvexError)) {
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

        // if attempt mode is practice, we directly show if the currentAnswer is correct or not
        if (attempt?.mode === "practice" && currentAnswer) {
          if (checked && !currentAnswer.isCorrect) {
            variant = "destructive-outline";
          }
          if (!currentAnswer.isCorrect && choice.value) {
            variant = "default-outline";
          }
        }

        return (
          <Label
            className={cn(
              buttonVariants({ variant }),
              "h-auto justify-start font-normal text-base"
            )}
            key={choice.label}
          >
            <Checkbox
              checked={checked}
              className="cursor-pointer"
              disabled={isInputLocked || isPending}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleSubmit({ index });
                }
              }}
            />
            <Response className="h-auto" id={`${id}-${choice.label}`}>
              {choice.label}
            </Response>
          </Label>
        );
      })}
    </div>
  );
}
