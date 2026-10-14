"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { PlayerQuestionModel } from "@/components/player/model";
import { readPosition } from "@/components/player/order";
import { usePlayer } from "@/components/player/provider";

/** Lays question numbers out in a grid; a click on one goes to that question. */
export function PlayerGrid({
  questions,
}: {
  questions: readonly PlayerQuestionModel[];
}) {
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(10),1fr))] gap-2">
      {Arr.map(questions, (question) => (
        <li key={question.key}>
          <PlayerCell question={question} />
        </li>
      ))}
    </ol>
  );
}

/**
 * One question number. An unanswered question is outlined, an answered one is
 * filled, and the current one carries a ring and `aria-current`, so no state
 * relies on color alone.
 */
function PlayerCell({ question }: { question: PlayerQuestionModel }) {
  const t = useTranslations("Player");
  const number = usePlayer((state) => readPosition(state.keys, question.key));
  const current = usePlayer((state) => state.current === question.key);
  const goTo = usePlayer((state) => state.goTo);

  return (
    <Button
      aria-current={current ? "step" : undefined}
      aria-label={t("cell", {
        number,
        state: question.answered ? "answered" : "unanswered",
      })}
      className="w-full px-0 font-mono tabular-nums aria-[current=step]:ring-2 aria-[current=step]:ring-ring aria-[current=step]:ring-offset-2 aria-[current=step]:ring-offset-background"
      onClick={() => goTo(question.key)}
      type="button"
      variant={question.answered ? "default" : "outline"}
    >
      {number}
    </Button>
  );
}
