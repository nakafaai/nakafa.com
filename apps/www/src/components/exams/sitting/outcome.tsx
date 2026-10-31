import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import { useTranslations } from "use-intl";
import { StudentResults } from "@/components/exams/results/student";
import type { AttemptValue } from "@/components/exams/sitting/attempt";
import { SittingBar } from "@/components/exams/sitting/bar";
import { SittingBody } from "@/components/exams/sitting/body";

/** The copy key of each state of an attempt that takes no answers before it is finished. */
const sentenceKeys = {
  closing: "student-attempt-closed",
  locked: "student-locked",
} satisfies Record<
  Exclude<AttemptValue["state"], "inProgress" | "submitted">,
  "student-attempt-closed" | "student-locked"
>;

/**
 * An attempt that takes no answers, shown without an entry: the exam's name, then a finished attempt's own
 * result card at the top, which says the exam is finished and shows the score once the teacher releases it,
 * or the one sentence of a closing or locked attempt. This screen forgets nothing: the finish forgets the
 * kept state once the server confirms it, and this screen shows the finish before that, so a refused finish
 * that rolls back would otherwise lose the answers that the student has not sent yet.
 */
export function StudentOutcome({
  attempt,
  sitting,
}: {
  readonly attempt: AttemptValue;
  readonly sitting: typeof SittingView.Type;
}) {
  const t = useTranslations("Exams");

  return (
    <>
      <SittingBar examTitle={sitting.examTitle} />
      <SittingBody align="top">
        {attempt.state === "submitted" ? (
          <StudentResults sittingId={sitting.id} />
        ) : null}
        {attempt.state === "closing" || attempt.state === "locked" ? (
          <p>{t(sentenceKeys[attempt.state])}</p>
        ) : null}
      </SittingBody>
    </>
  );
}
