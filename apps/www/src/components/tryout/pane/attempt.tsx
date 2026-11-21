import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { PaneFact, PaneFacts } from "@/components/shared/page/pane";
import { useSetPane } from "@/components/tryout/pane/context";
import { TryoutResultFacts } from "@/components/tryout/review/result";
import { TryoutClock } from "@/components/tryout/runtime/countdown";
import { TryoutAttemptPicker } from "@/components/tryout/score/history";
import { useFactsWaiting } from "@/components/tryout/set/name";

/** The day an attempt was taken, short enough for a fact. */
const TAKEN = { day: "numeric", month: "short", year: "numeric" } as const;

/**
 * The first part of the pane, with no title, since its facts already say whether the attempt runs or ended: the
 * picker of the set's attempts, then the attempt's facts. A line across the pane parts it from the path.
 */
function AttemptPart({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { view } = useSetPane();
  return (
    <section
      className={cn(
        "-mx-(--pane-end,1rem) flex flex-col gap-4 border-b px-(--pane-end,1rem) py-4 first:pt-0 last:border-b-0 last:pb-0",
        className
      )}
    >
      <TryoutAttemptPicker
        attempt={view.actionAttempt}
        locale={view.route.locale}
        place="pane"
        set={view.page.set}
      />
      {children}
    </section>
  );
}

/** A running attempt's facts: the time it has left, ticking, and how many parts it finished. */
function RunningFacts({
  attempt,
}: {
  attempt: { completedSectionKeys: readonly string[]; expiresAt: number };
}) {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const { sections } = useSetPane();
  return (
    <PaneFacts layout="grid">
      <PaneFact label={t("remaining-time-label")}>
        <TryoutClock expiresAt={attempt.expiresAt} />
      </PaneFact>
      <PaneFact label={t("parts-done-label")}>
        {tCommon("count-of", {
          count: attempt.completedSectionKeys.length,
          total: sections.length,
        })}
      </PaneFact>
    </PaneFacts>
  );
}

/**
 * The attempt part while the learner's read is on its way. A set this browser last saw finished and tried more
 * than once holds its picker from the first frame (`TryoutAttemptPicker`), and with it the room its result's facts
 * take, so nothing in the pane moves when the read answers. Any other set's place stays hidden, and the part with it.
 */
function WaitingAttempt() {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const labels = [
    t("score-label.standard"),
    t("correct-answers-label"),
    t("rank-label"),
    tCommon("date"),
  ];
  return (
    <AttemptPart className="hidden has-[[data-attempt-picker]:not([hidden])]:flex">
      <PaneFacts layout="grid">
        {Arr.map(labels, (label) => (
          <PaneFact key={label} label={label}>
            <span aria-hidden className="invisible">
              0
            </span>
          </PaneFact>
        ))}
      </PaneFacts>
    </AttemptPart>
  );
}

/**
 * The attempt the pane shows (the owner's notes of 20 Nov): the clock and the parts done of one that runs, or the
 * result of one that ended, with the place its score takes on the set's board and the day it was taken. A set the
 * learner has not started shows none, and a pane whose read is on its way holds the room a kept result takes.
 */
export function SetAttempt() {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const { board, view } = useSetPane();
  const attempt = view.actionAttempt;
  // The static first paint is every reader's, so it waits for the learner's read as a pending one does.
  const waiting = useFactsWaiting(attempt === undefined);
  if (waiting) {
    return <WaitingAttempt />;
  }
  if (attempt === undefined || attempt === null) {
    return null;
  }
  if (attempt.status === "in-progress") {
    return (
      <AttemptPart>
        <RunningFacts attempt={attempt} />
      </AttemptPart>
    );
  }
  if (attempt.score === null) {
    return null;
  }
  const standing = Option.flatMap(board, (value) =>
    Option.map(Option.fromNullOr(value.standing), (place) => ({
      count: value.count,
      place,
    }))
  );
  return (
    <AttemptPart>
      <TryoutResultFacts score={attempt.score}>
        {Option.match(standing, {
          onNone: () => null,
          onSome: ({ count, place }) => (
            <PaneFact label={t("rank-label")}>
              {tCommon("count-of", { count: place, total: count })}
            </PaneFact>
          ),
        })}
        <PaneFact label={tCommon("date")}>
          {format.dateTime(attempt.startedAt, TAKEN)}
        </PaneFact>
      </TryoutResultFacts>
    </AttemptPart>
  );
}
