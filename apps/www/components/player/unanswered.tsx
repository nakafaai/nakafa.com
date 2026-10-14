"use client";

import { useTranslations } from "next-intl";
import type { PlayerQuestionModel } from "@/components/player/model";
import { PlayerGrid } from "@/components/player/navigator/grid";

/** Shows the numbers of the questions still open, so a learner can go back to one before finishing. */
export function PlayerUnanswered({
  questions,
}: {
  questions: readonly PlayerQuestionModel[];
}) {
  const t = useTranslations("Player");

  return (
    <section className="grid gap-3">
      <h3 className="font-medium text-sm">{t("unanswered")}</h3>
      <PlayerGrid questions={questions} />
    </section>
  );
}
