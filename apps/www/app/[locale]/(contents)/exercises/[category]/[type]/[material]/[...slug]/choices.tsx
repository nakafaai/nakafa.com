"use client";

import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";
import { Response } from "@repo/design-system/components/ai/response";
import {
  type Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";
import { useExercise } from "@/lib/context/use-exercise";

type Props = {
  id: string;
  exerciseNumber: number;
  choices: ExercisesChoices[keyof ExercisesChoices];
};

export function ExerciseChoices({ id, exerciseNumber, choices }: Props) {
  const selectAnswer = useExercise((state) => state.selectAnswer);
  const clearAnswer = useExercise((state) => state.clearAnswer);
  const answer = useExercise((state) => state.answers[exerciseNumber]);

  const correctChoice = choices.find((choice) => choice.value);

  const handleChoiceClick = (choiceLabel: string) => {
    if (answer?.selected === choiceLabel) {
      clearAnswer(exerciseNumber);
      return;
    }

    if (!correctChoice) {
      return;
    }

    selectAnswer({
      exerciseNumber,
      choice: choiceLabel,
      correctAnswer: correctChoice.label,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-2 pt-4 pb-8 md:grid-cols-2">
      {choices.map((choice) => {
        const isCorrect =
          answer?.isCorrect && choice.value === correctChoice?.value;
        const isIncorrect = answer?.selected === choice.label && !isCorrect;

        let variant: ComponentProps<typeof Button>["variant"] = "outline";
        if (isIncorrect) {
          variant = "destructive-outline";
        }
        if (isCorrect) {
          variant = "default-outline";
        }

        return (
          <Label
            className={cn(buttonVariants({ variant }), "h-auto justify-start")}
            key={choice.label}
          >
            <Checkbox
              checked={answer?.selected === choice.label}
              className="cursor-pointer"
              onCheckedChange={() => handleChoiceClick(choice.label)}
            />
            <Response id={`${id}-${choice.label}`}>{choice.label}</Response>
          </Label>
        );
      })}
    </div>
  );
}
