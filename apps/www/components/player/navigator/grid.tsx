"use client";

import { Flag01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import {
  type PlayerQuestion,
  usePlayerView,
} from "@/components/player/context";

/** Number grid; flags and the current ring never move a cell. */
export function PlayerGrid({
  questions,
}: {
  readonly questions: readonly PlayerQuestion[];
}) {
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(10),1fr))] gap-2">
      {questions.map((question) => (
        <li key={question.key}>
          <PlayerCell question={question} />
        </li>
      ))}
    </ol>
  );
}

/**
 * One question number: empty outlined, answered filled, flagged in the
 * secondary fill with a flag, and the current one ringed. A click jumps there.
 */
function PlayerCell({ question }: { readonly question: PlayerQuestion }) {
  const t = useTranslations("Player");
  const current = usePlayerView((view) => view.current === question.key);
  const goTo = usePlayerView((view) => view.goTo);
  let variant: "default" | "outline" | "secondary" = "outline";
  if (question.flagged) {
    variant = "secondary";
  } else if (question.answered) {
    variant = "default";
  }
  return (
    <Button
      aria-current={current ? "step" : undefined}
      aria-label={t("cell", {
        answered: String(question.answered),
        flagged: String(question.flagged),
        number: question.number,
      })}
      className="relative w-full px-0 font-mono tabular-nums aria-[current=step]:ring-2 aria-[current=step]:ring-ring aria-[current=step]:ring-offset-2 aria-[current=step]:ring-offset-background"
      onClick={() => goTo(question.key)}
      type="button"
      variant={variant}
    >
      {question.number}
      {question.flagged ? (
        <HugeIcons
          className="absolute top-0.5 right-0.5 size-3"
          icon={Flag01Icon}
        />
      ) : null}
    </Button>
  );
}
