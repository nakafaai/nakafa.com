import { Flag02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import type { PlayerCellModel } from "@/components/player/model";
import { readPosition } from "@/components/player/order";
import { usePlayer } from "@/components/player/provider";

/** Lays question numbers out in a grid; a click on one goes to that question. */
export function PlayerGrid({
  questions,
}: {
  questions: readonly PlayerCellModel[];
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
 * One question number. An unanswered question is outlined in the destructive
 * color, an answered one is filled, a flagged one carries a flag mark on its
 * corner, and the current one carries a ring and `aria-current`, so no state
 * relies on color alone. The mark sits over the corner, so a flag never moves
 * the number.
 */
function PlayerCell({ question }: { question: PlayerCellModel }) {
  const t = useTranslations("Player");
  const number = usePlayer((state) => readPosition(state.keys, question.key));
  const current = usePlayer((state) => state.current === question.key);
  const goTo = usePlayer((state) => state.goTo);
  const state = question.answered ? "answered" : "unanswered";

  return (
    <Button
      aria-current={current ? "step" : undefined}
      aria-label={
        question.flagged
          ? t("cell-flagged", { number, state })
          : t("cell", { number, state })
      }
      className="relative w-full px-0 font-mono tabular-nums aria-[current=step]:ring-2 aria-[current=step]:ring-ring aria-[current=step]:ring-offset-2 aria-[current=step]:ring-offset-background"
      onClick={() => goTo(question.key)}
      type="button"
      variant={question.answered ? "default" : "destructive-outline"}
    >
      {number}
      {question.flagged ? <PlayerFlagMark placement="corner" /> : null}
    </Button>
  );
}

const flagMarkVariants = cva(
  "grid size-4 shrink-0 place-items-center rounded-full bg-warning text-warning-foreground",
  {
    variants: {
      placement: {
        corner: "absolute -end-1.5 -top-1.5 ring-2 ring-background",
        inline: "",
      },
    },
  }
);

/**
 * The flag mark of a flagged question: a small flag in the flag color, on the
 * top end corner of its number, or in line where the legend names it.
 */
export function PlayerFlagMark({
  placement,
}: {
  placement: "corner" | "inline";
}) {
  return (
    <span aria-hidden="true" className={flagMarkVariants({ placement })}>
      <HugeIcons className="size-2.5" icon={Flag02Icon} />
    </span>
  );
}
