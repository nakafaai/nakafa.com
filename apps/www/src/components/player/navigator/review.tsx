import {
  Cancel01Icon,
  HourglassIcon,
  MinusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { Verdict } from "@repo/backend/confect/assessment/verdict";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import type {
  PlayerReviewCellModel,
  PlayerVerdict,
} from "@/components/player/model";
import { usePlayer } from "@/components/player/provider";

/** How a number shows each verdict, as the choices of a reviewed question do. */
const VERDICT_VARIANT = {
  answered: "default",
  correct: "success-outline",
  incorrect: "destructive-outline",
  partial: "secondary-outline",
  pending: "secondary-outline",
  unanswered: "outline",
} as const satisfies Record<PlayerVerdict, string>;

/** The mark a graded verdict carries on its number's corner, so no verdict relies on color alone. */
const VERDICT_MARK = {
  correct: Tick02Icon,
  incorrect: Cancel01Icon,
  partial: MinusSignIcon,
  pending: HourglassIcon,
} as const satisfies Record<Verdict, unknown>;

const verdictMarkVariants = cva(
  "ring-background absolute -end-1.5 -top-1.5 grid size-4 place-items-center rounded-full ring-2",
  {
    variants: {
      verdict: {
        correct: "bg-success text-success-foreground",
        incorrect: "bg-destructive text-destructive-foreground",
        partial: "bg-warning text-warning-foreground",
        pending: "bg-muted text-muted-foreground",
      },
    },
  }
);

/**
 * Lays a finished paper's numbers out in a grid, as the navigator of a running paper does: a press on one
 * goes to that question. Each number shows its verdict, in its outline and in a mark on its corner, and the
 * current one carries a ring and `aria-current`.
 */
export function PlayerReviewGrid({
  questions,
}: {
  questions: readonly PlayerReviewCellModel[];
}) {
  return (
    <ol className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(10),1fr))] gap-2">
      {Arr.map(questions, (question, index) => (
        <li key={question.key}>
          <PlayerReviewCell number={index + 1} question={question} />
        </li>
      ))}
    </ol>
  );
}

/** One number of a finished paper. A question the page does not show has nowhere to go, so its number takes no press. */
function PlayerReviewCell({
  number,
  question,
}: {
  number: number;
  question: PlayerReviewCellModel;
}) {
  const t = useTranslations("Player");
  const current = usePlayer((state) => state.current === question.key);
  const goTo = usePlayer((state) => state.goTo);

  return (
    <Button
      aria-current={current ? "step" : undefined}
      aria-label={t("cell-verdict", { number, state: question.verdict })}
      className="aria-[current=step]:ring-ring aria-[current=step]:ring-offset-background relative w-full px-0 font-mono tabular-nums aria-[current=step]:ring-2 aria-[current=step]:ring-offset-2"
      disabled={!question.shown}
      onClick={() => goTo(question.key)}
      type="button"
      variant={VERDICT_VARIANT[question.verdict]}
    >
      {number}
      <PlayerVerdictMark verdict={question.verdict} />
    </Button>
  );
}

/** The corner mark of a graded number: a tick, a cross, a minus for some points, or an hourglass while it waits. */
function PlayerVerdictMark({ verdict }: { verdict: PlayerVerdict }) {
  if (verdict === "answered" || verdict === "unanswered") {
    return null;
  }
  return (
    <span aria-hidden="true" className={verdictMarkVariants({ verdict })}>
      <HugeIcons className="size-2.5" icon={VERDICT_MARK[verdict]} />
    </span>
  );
}
