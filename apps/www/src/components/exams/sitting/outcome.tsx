import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import { CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { useTranslations } from "use-intl";
import { StudentResults } from "@/components/exams/results/student";
import type { AttemptValue } from "@/components/exams/sitting/attempt";
import { PaperBack, PaperBar } from "@/components/exams/sitting/bar";
import { SittingBody } from "@/components/exams/sitting/body";
import { PaperFrame } from "@/components/exams/sitting/recovery";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";

/** The card of each state of an attempt that takes no answers before it is finished: its title and its sentence. */
const stoppedCards = {
  closing: { hint: "student-attempt-closed", title: "student-closed-title" },
  locked: { hint: "student-locked", title: "student-locked-title" },
} as const;

/**
 * An attempt that takes no answers, shown without an entry: the exam's name, then a finished attempt's own
 * result card at the top, which says the exam is finished and shows the score once the teacher releases it,
 * or the card of a closing or locked attempt, so every ending reads the same way. This screen forgets nothing: the finish forgets the
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
    <PaperFrame
      bar={<PaperBar back={<PaperBack />} title={sitting.examTitle} />}
    >
      <SittingBody>
        {attempt.state === "submitted" ? (
          <StudentResults sittingId={sitting.id} />
        ) : null}
        {attempt.state === "closing" || attempt.state === "locked" ? (
          <CardSection>
            <CardHeader>
              <CardTitle>{t(stoppedCards[attempt.state].title)}</CardTitle>
            </CardHeader>
            <CardSectionFooter hint={t(stoppedCards[attempt.state].hint)} />
          </CardSection>
        ) : null}
      </SittingBody>
    </PaperFrame>
  );
}
