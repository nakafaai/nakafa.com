"use client";

import { Separator } from "@repo/design-system/components/ui/separator";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { useExercise } from "@/lib/context/use-exercise";

interface Props {
  children: React.ReactNode;
  exerciseNumber: number;
}

export function ExerciseAnswer({ children, exerciseNumber }: Props) {
  const t = useTranslations("Exercises");
  const showAnswer = useExercise(
    (state) => state.visibleExplanations[exerciseNumber] ?? false
  );

  return (
    <section className={cn("space-y-6", showAnswer ? "visible" : "hidden")}>
      <Separator orientation="horizontal" />
      <div className="space-y-6">
        <h3
          className="font-medium text-lg"
          id={`explanation-${exerciseNumber}`}
        >
          {t("explanation")}
        </h3>
        {children}
      </div>
    </section>
  );
}
