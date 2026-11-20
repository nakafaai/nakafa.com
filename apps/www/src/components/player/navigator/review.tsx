import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import {
  VERDICT_VARIANT,
  verdictNumberVariants,
} from "@/components/player/look";
import type { PlayerReviewCellModel } from "@/components/player/model";
import { usePlayer } from "@/components/player/provider";
import { PlayerVerdictMark } from "@/components/player/verdict";

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
      className={cn(
        verdictNumberVariants({ verdict: question.verdict }),
        "aria-[current=step]:ring-ring aria-[current=step]:ring-offset-background w-full px-0 font-mono tabular-nums aria-[current=step]:ring-2 aria-[current=step]:ring-offset-2"
      )}
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
