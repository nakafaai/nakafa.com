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
import { useTranslations } from "next-intl";
import { type ComponentProps, useTransition } from "react";
import { toast } from "sonner";
import { useAttempt } from "@/lib/context/use-attempt";
import { useExercise } from "@/lib/context/use-exercise";

interface Props {
  id: string;
  exerciseNumber: number;
  choices: ExercisesChoices[keyof ExercisesChoices];
}

export function ExerciseChoices({ id, exerciseNumber, choices }: Props) {
  const t = useTranslations("Exercises");

  const [isPending, startTransition] = useTransition();

  const attempt = useAttempt((state) => state.attempt);
  const answers = useAttempt((state) => state.answers);

  const submitAttempt = useMutation(api.exercises.mutations.submitAnswer);
  const timeSpent = useExercise(
    (state) => state.timeSpent[exerciseNumber] ?? 0
  );

  const currentAnswer = answers.find(
    (a) => a.exerciseNumber === exerciseNumber
  );

  function handleSubmit(choice: ExercisesChoices[keyof ExercisesChoices][0]) {
    if (!attempt) {
      return;
    }

    // If the attempt is not in progress, tell user to start new attempt
    if (attempt.status !== "in-progress") {
      toast.info(t("attempt-not-in-progress"));
      return;
    }

    startTransition(async () => {
      try {
        await submitAttempt({
          attemptId: attempt._id,
          exerciseNumber,
          selectedOptionId: choice.label,
          textAnswer: choice.label,
          isCorrect: choice.value,
          timeSpent,
        });
      } catch {
        // Ignore error
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {choices.map((choice) => {
        let variant: ComponentProps<typeof Button>["variant"] = "outline";
        const checked = currentAnswer?.selectedOptionId === choice.label;

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
              checked={currentAnswer?.selectedOptionId === choice.label}
              className="cursor-pointer"
              disabled={isPending}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleSubmit(choice);
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
