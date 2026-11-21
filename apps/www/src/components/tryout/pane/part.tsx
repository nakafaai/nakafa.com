import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Number as Num, Option } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { formatClock } from "@/components/player/time";
import { PaneFact, PaneFacts } from "@/components/shared/page/pane";
import type { PartScoreSummary } from "@/components/tryout/pane/model";
import type { TryoutPart } from "@/components/tryout/set/model";

/**
 * Shows one part's facts or score right in a dialog instead of opening an empty summary page: for a part finished
 * while its set still runs, its score, correct count and time until review unlocks; for a missed part on an ended
 * attempt, its question count and duration.
 */
export function TryoutPartInfoDialog({
  open,
  part,
  score,
  setOpen,
}: {
  readonly open: boolean;
  readonly part: TryoutPart;
  readonly score: Option.Option<PartScoreSummary>;
  readonly setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const format = useFormatter();

  return (
    <ResponsiveDialog
      description={t(
        Option.isSome(score)
          ? "part-done-description"
          : "part-missed-description"
      )}
      open={open}
      setOpen={setOpen}
      title={part.title}
    >
      {Option.match(score, {
        onNone: () => (
          <PaneFacts layout="grid">
            <PaneFact label={tCommon("exam-questions")}>
              {format.number(part.questionCount)}
            </PaneFact>
            <PaneFact label={t("set-column-duration")}>
              {t("set-duration-minutes", {
                minutes: part.timeLimitSeconds / 60,
              })}
            </PaneFact>
          </PaneFacts>
        ),
        onSome: (scored) => {
          const used = Option.map(
            Option.fromNullOr(scored.completedAt),
            (completedAt) =>
              Num.min(
                Math.max(
                  0,
                  Math.floor((completedAt - scored.startedAt) / 1000)
                ),
                part.timeLimitSeconds
              )
          );
          return (
            <PaneFacts layout="grid">
              <PaneFact
                label={t(
                  scored.scoreStatus === "provisional"
                    ? "score-label.estimated"
                    : "score-label.standard"
                )}
              >
                {format.number(scored.publishedScore)}
              </PaneFact>
              <PaneFact label={t("correct-answers-label")}>
                {tCommon("count-of", {
                  count: scored.totalCorrect,
                  total: scored.totalQuestions,
                })}
              </PaneFact>
              {Option.match(used, {
                onNone: () => null,
                onSome: (seconds) => (
                  <PaneFact label={t("time-used-label")}>
                    {formatClock(seconds)}
                  </PaneFact>
                ),
              })}
              <PaneFact label={t("time-limit-label")}>
                {formatClock(part.timeLimitSeconds)}
              </PaneFact>
            </PaneFacts>
          );
        },
      })}
    </ResponsiveDialog>
  );
}
