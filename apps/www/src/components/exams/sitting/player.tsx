import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  runSittingCall,
  sittingCallFailures,
} from "@/components/exams/sitting/actions";
import { useChooseAnswer, useFinish } from "@/components/exams/sitting/answer";
import {
  type AttemptValue,
  isActive,
  secondsLeft,
  takesAnswers,
} from "@/components/exams/sitting/attempt";
import { SittingBar } from "@/components/exams/sitting/bar";
import { serverTime } from "@/components/exams/sitting/clock";
import { sittingFailureMessage } from "@/components/exams/sitting/entry";
import { forgetKeptAttempt } from "@/components/exams/sitting/forget";
import { useResendKeptAnswers } from "@/components/exams/sitting/kept";
import { useMarkFlag } from "@/components/exams/sitting/mark";
import { SittingNavigator } from "@/components/exams/sitting/navigator";
import type { PaperValue } from "@/components/exams/sitting/paper";
import { SittingQuestion } from "@/components/exams/sitting/question";
import { projectSittingQuestions } from "@/components/exams/sitting/questions";
import { SittingRetry } from "@/components/exams/sitting/retry";
import { useSittingSignals } from "@/components/exams/sitting/signals";
import { useSittingClock } from "@/components/exams/sitting/timer";
import { PlayerFinish } from "@/components/player/finish";
import { PlayerFooter, PlayerOpener } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import { PlayerKeys } from "@/components/player/keys";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerShortcuts } from "@/components/player/navigator/shortcuts";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerModeToggle } from "@/components/player/navigator/toggle";
import { PlayerProvider } from "@/components/player/provider";
import { PlayerQuestions } from "@/components/player/questions";
import { PlayerTimer } from "@/components/player/timer";

/**
 * The student's running attempt in the shared player: the school's header with the exam's name, the time
 * left, and the one primary action, then the paper with its navigator, its keys, and its view. A locked
 * attempt shows the same header, with the lock's sentence in place of the paper. The signals run while the
 * attempt is active.
 */
export function StudentPlayer({
  attempt,
  clockOffset,
  deviceId,
  mode,
  sitting,
  slug,
}: {
  readonly attempt: AttemptValue;
  readonly clockOffset: number;
  readonly deviceId: string;
  /** The view the server resolved from the address and the saved view. */
  readonly mode: PlayerMode;
  readonly sitting: typeof SittingView.Type;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const sittingId = sitting.id;

  useSittingSignals({
    attemptId: attempt.id,
    deviceId,
    enabled: isActive(attempt.state),
    slug,
  });

  const paper = useQuery(
    exams.sittings.paper,
    takesAnswers(attempt.state) ? { deviceId, sittingId, slug } : "skip"
  );
  const timer = isActive(attempt.state) ? (
    <SittingTimer clockOffset={clockOffset} deadline={attempt.deadline} />
  ) : null;

  if (QueryResult.isSuccess(paper) && takesAnswers(attempt.state)) {
    return (
      <RunningPaper
        attemptId={attempt.id}
        deviceId={deviceId}
        header={
          <SittingBar examTitle={sitting.examTitle}>
            {timer}
            <StudentFinish
              attempt={attempt}
              deviceId={deviceId}
              locked={false}
              sittingId={sittingId}
              slug={slug}
            />
            <PlayerOpener />
          </SittingBar>
        }
        mode={mode}
        paper={paper.value}
        sittingId={sittingId}
        slug={slug}
      />
    );
  }

  return (
    <PlayerProvider keys={[]} mode={mode}>
      <SittingBar examTitle={sitting.examTitle}>
        {timer}
        {isActive(attempt.state) ? (
          <StudentFinish
            attempt={attempt}
            deviceId={deviceId}
            locked={!takesAnswers(attempt.state)}
            sittingId={sittingId}
            slug={slug}
          />
        ) : null}
      </SittingBar>
      <PlayerMain navigator={null}>
        {attempt.state === "locked" ? <p>{t("student-locked")}</p> : null}
        {QueryResult.isFailure(paper)
          ? Option.match(sittingFailureMessage(paper.error), {
              onNone: () => <SittingRetry error={paper.error} />,
              onSome: (message) => <p>{t(message)}</p>,
            })
          : null}
      </PlayerMain>
    </PlayerProvider>
  );
}

/**
 * The student's one primary action, which a lock holds closed. It asks before the answers close, and it
 * exists only while the attempt is active.
 */
function StudentFinish({
  attempt,
  deviceId,
  locked,
  sittingId,
  slug,
}: {
  readonly attempt: AttemptValue;
  readonly deviceId: string;
  readonly locked: boolean;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const tTryouts = useTranslations("Tryouts");
  const finish = useFinish();

  return (
    <PlayerFinish
      description={t("finish-description")}
      label={tTryouts("complete-part-cta")}
      locked={locked}
      onFinish={() =>
        runSittingCall(
          () => finish({ deviceId, sittingId, slug }),
          () => {
            forgetKeptAttempt(sittingId, attempt.id);
          }
        )
      }
      pending={false}
      title={t("finish-title")}
    />
  );
}

/** The timer of the attempt, counted down on the server's time: the device's time corrected by the offset. */
function SittingTimer({
  clockOffset,
  deadline,
}: {
  readonly clockOffset: number;
  readonly deadline: number;
}) {
  const now = useSittingClock();

  return (
    <PlayerTimer
      seconds={secondsLeft(deadline, serverTime(now, clockOffset))}
    />
  );
}

/**
 * The paper of an open attempt. The keys, the flags, and the navigator follow the paper, the answers the
 * student sends are kept until the server confirms them, and the kept answers of an earlier visit are sent
 * again once the paper is on the screen.
 */
function RunningPaper({
  attemptId,
  deviceId,
  header,
  mode,
  paper,
  sittingId,
  slug,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  readonly deviceId: string;
  readonly header: ReactNode;
  readonly mode: PlayerMode;
  readonly paper: PaperValue;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const choose = useChooseAnswer();
  const mark = useMarkFlag();
  useResendKeptAnswers({ attemptId, deviceId, paper, sittingId, slug });

  /** Marks or unmarks the question with `key` for review, and tells the student when the server refuses it. */
  function onMark(key: string) {
    const question = Arr.findFirst(paper.questions, (item) => item.id === key);
    if (Option.isSome(question)) {
      Effect.runPromise(
        mark({
          deviceId,
          flagged: !question.value.flagged,
          questionId: question.value.id,
          sittingId,
          slug,
        }).pipe(
          Effect.flatMap((failure) =>
            sittingCallFailures(Option.toArray(failure))
          )
        )
      );
    }
  }

  return (
    <PlayerProvider
      keys={Arr.map(paper.questions, (question) => question.id)}
      mode={mode}
    >
      <PlayerKeys
        locked={false}
        onMark={onMark}
        questions={projectSittingQuestions({
          choose: (question, response) =>
            choose({
              attemptId,
              deviceId,
              question,
              response,
              sittingId,
              slug,
            }),
          paper,
        })}
      />
      {header}
      <PlayerMain
        navigator={
          <PlayerSidebar>
            <SittingNavigator questions={paper.questions} />
            <PlayerModeToggle />
            <PlayerShortcuts />
          </PlayerSidebar>
        }
      >
        <PlayerQuestions>
          {Arr.map(paper.questions, (question) => (
            <SittingQuestion
              attemptId={attemptId}
              deviceId={deviceId}
              key={question.id}
              question={question}
              sittingId={sittingId}
              slug={slug}
            />
          ))}
        </PlayerQuestions>
      </PlayerMain>
      <PlayerFooter />
      <PlayerSheet>
        <SittingNavigator questions={paper.questions} />
        <PlayerModeToggle />
      </PlayerSheet>
    </PlayerProvider>
  );
}
