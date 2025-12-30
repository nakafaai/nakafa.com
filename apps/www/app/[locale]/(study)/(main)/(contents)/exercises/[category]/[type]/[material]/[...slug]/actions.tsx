"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { useExercise } from "@/lib/context/use-exercise";

interface Props {
  exerciseNumber: number;
}

export function ExerciseAnswerAction({ exerciseNumber }: Props) {
  const t = useTranslations("Exercises");
  const toggleAnswer = useExercise((state) => state.toggleAnswer);
  const showAnswer = useExercise(
    (state) => state.visibleExplanations[exerciseNumber] ?? false
  );

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => toggleAnswer(exerciseNumber)} variant="outline">
        {t("explanation")}
        <HugeIcons
          className={cn(
            "transition-transform ease-out",
            !!showAnswer && "rotate-180"
          )}
          icon={ArrowDown01Icon}
        />
      </Button>
    </div>
  );
}
