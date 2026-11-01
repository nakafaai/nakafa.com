import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { useTranslations } from "use-intl";
import { StudentResults } from "@/components/exams/results/student";
import type { AttemptValue } from "@/components/exams/sitting/attempt";
import { PaperBack, PaperBar } from "@/components/exams/sitting/bar";
import { SittingBody, SittingNotice } from "@/components/exams/sitting/body";
import { useSendClosedKept } from "@/components/exams/sitting/kept";
import { PaperFrame } from "@/components/exams/sitting/recovery";

/** The words of each state of an attempt that takes no answers before it is finished: its title and its sentence. */
const stoppedCards = {
  closing: {
    description: "student-closed-description",
    hint: "student-attempt-closed",
    title: "student-closed-title",
  },
  locked: {
    description: "student-locked-description",
    hint: "student-locked",
    title: "student-locked-title",
  },
} as const;

/**
 * An attempt that takes no answers, shown without an entry: the exam's name, then a finished attempt's own
 * result at the top, which says the exam is finished and shows the score once the teacher releases it,
 * or the words of a closing or locked attempt, so every ending reads the same way. This screen forgets nothing: the finish forgets the
 * kept state once the server confirms it, and this screen shows the finish before that, so a refused finish
 * that rolls back would otherwise lose the answers that the student has not sent yet.
 */
export function StudentOutcome({
  arrived,
  attempt,
  sitting,
  slug,
}: {
  /** Whether this visit arrived at a closed attempt, rather than watching it close. */
  readonly arrived: boolean;
  readonly attempt: AttemptValue;
  readonly sitting: typeof SittingView.Type;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  useSendClosedKept({
    attemptId: attempt.id,
    enabled: arrived,
    sittingId: sitting.id,
    slug,
  });

  return (
    <PaperFrame
      bar={<PaperBar back={<PaperBack />} title={sitting.examTitle} />}
    >
      <SittingBody>
        {attempt.state === "submitted" ? (
          <StudentResults sittingId={sitting.id} />
        ) : null}
        {attempt.state === "closing" || attempt.state === "locked" ? (
          <SittingNotice
            description={t(stoppedCards[attempt.state].description)}
            title={t(stoppedCards[attempt.state].title)}
          >
            <p className="text-sm">{t(stoppedCards[attempt.state].hint)}</p>
          </SittingNotice>
        ) : null}
      </SittingBody>
    </PaperFrame>
  );
}
