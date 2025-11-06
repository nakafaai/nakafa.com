"use client";

import { Separator } from "@repo/design-system/components/ui/separator";
import { useTranslations } from "next-intl";
import { Activity } from "react";
import { useExercise } from "@/lib/context/use-exercise";

type Props = {
  children: React.ReactNode;
  exerciseNumber: number;
};

export function ExerciseAnswer({ children, exerciseNumber }: Props) {
  const t = useTranslations("Exercises");
  const showAnswer = useExercise(
    (state) => state.visibleExplanations[exerciseNumber] ?? false
  );

  return (
    <Activity mode={showAnswer ? "visible" : "hidden"}>
      <section className="space-y-6">
        <Separator orientation="horizontal" />
        <div className="space-y-4">
          <p className="font-medium">{t("explanation")}</p>
          {children}
        </div>
      </section>
    </Activity>
  );
}
