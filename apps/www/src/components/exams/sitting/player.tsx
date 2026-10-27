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
import {
  isRetiredDevice,
  sittingFailureMessage,
} from "@/components/exams/sitting/entry";
import { forgetKeptAttempt } from "@/components/exams/sitting/forget";
import { useResendKeptAnswers } from "@/components/exams/sitting/kept";
import { SittingLook } from "@/components/exams/sitting/look";
import { useMarkFlag } from "@/components/exams/sitting/mark";
import { useSittingMode } from "@/components/exams/sitting/mode";
import type { PaperValue } from "@/components/exams/sitting/paper";
import { SittingQuestion } from "@/components/exams/sitting/question";
import {
  projectSittingCells,
  projectSittingQuestions,
} from "@/components/exams/sitting/questions";
import { SittingRetry } from "@/components/exams/sitting/retry";
import { useSittingSignals } from "@/components/exams/sitting/signals";
import { useSittingClock } from "@/components/exams/sitting/timer";
import { PlayerFinish } from "@/components/player/finish";
import { PlayerFlag } from "@/components/player/flag";
import { PlayerFooter, PlayerOpener } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import { PlayerKeys } from "@/components/player/keys";
import type { PlayerMode } from "@/components/player/mode";
import type { PlayerCellModel } from "@/components/player/model";
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerLegend } from "@/components/player/navigator/legend";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerProvider } from "@/components/player/provider";
import { PlayerQuestions } from "@/components/player/questions";
import { PlayerTimer } from "@/components/player/timer";

/**
 * The student's running attempt in the shared player: the school's header with the exam's name, the time
 * left, and the one primary action, then the paper with its navigator, its keys, and its view. A locked
 * attempt keeps the same header and navigator, and its paper reads only, with the lock's sentence above it.
 * The signals run while the attempt is active.
 */
export function StudentPlayer({
  attempt,
  clockOffset,
  deviceId,
  sitting,
  slug,
}: {
  readonly attempt: AttemptValue;
  readonly clockOffset: number;
  readonly deviceId: string;
  readonly sitting: typeof SittingView.Type;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const mode = useSittingMode();
  const sittingId = sitting.id;

  useSittingSignals({
    attemptId: attempt.id,
    deviceId,
    enabled: isActive(attempt.state),
    slug,
  });

  const paper = useQuery(
    exams.sittings.paper,
    isActive(attempt.state) ? { deviceId, sittingId, slug } : "skip"
  );
  if (QueryResult.isSuccess(paper) && isActive(attempt.state)) {
    return (
      <RunningPaper
        attemptId={attempt.id}
        deviceId={deviceId}
        header={
          <SittingBar examTitle={sitting.examTitle}>
            <SittingTimer
              clockOffset={clockOffset}
              deadline={attempt.deadline}
            />
            <StudentFinish
              attempt={attempt}
              deviceId={deviceId}
              locked={!takesAnswers(attempt.state)}
              questions={projectSittingCells(paper.value)}
              sittingId={sittingId}
              slug={slug}
            />
          </SittingBar>
        }
        locked={!takesAnswers(attempt.state)}
        mode={mode}
        paper={paper.value}
        sittingId={sittingId}
        slug={slug}
      />
    );
  }

  // A retired device holds the attempt no more, so its bar keeps the time and offers no Finish.
  const retired = QueryResult.isFailure(paper) && isRetiredDevice(paper.error);

  return (
    <PlayerProvider keys={[]} mode={mode}>
      <SittingBar examTitle={sitting.examTitle}>
        {isActive(attempt.state) ? (
          <>
            <SittingTimer
              clockOffset={clockOffset}
              deadline={attempt.deadline}
            />
            {retired ? null : (
              <StudentFinish
                attempt={attempt}
                deviceId={deviceId}
                locked={!takesAnswers(attempt.state)}
                questions={[]}
                sittingId={sittingId}
                slug={slug}
              />
            )}
          </>
        ) : null}
      </SittingBar>
      <PlayerMain navigator={null}>
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
 * The student's one primary action, which a lock holds closed. It reviews the flagged and the unanswered
 * questions before the answers close, and it exists only while the attempt is active.
 */
function StudentFinish({
  attempt,
  deviceId,
  locked,
  questions,
  sittingId,
  slug,
}: {
  readonly attempt: AttemptValue;
  readonly deviceId: string;
  readonly locked: boolean;
  readonly questions: readonly PlayerCellModel[];
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
      questions={questions}
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
 * The paper of an active attempt. The keys, the flags, and the navigator follow the paper, the answers the
 * student sends are kept until the server confirms them, and the kept answers of an earlier visit are sent
 * again once the paper is on the screen. A locked paper reads only: its options and flags are closed.
 */
function RunningPaper({
  attemptId,
  deviceId,
  header,
  locked,
  mode,
  paper,
  sittingId,
  slug,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  readonly deviceId: string;
  readonly header: ReactNode;
  readonly locked: boolean;
  readonly mode: PlayerMode;
  readonly paper: PaperValue;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const choose = useChooseAnswer();
  const mark = useMarkFlag();
  useResendKeptAnswers({ attemptId, deviceId, locked, paper, sittingId, slug });

  const questions = projectSittingQuestions({
    choose: (question, response) =>
      choose({
        attemptId,
        deviceId,
        question,
        response,
        sittingId,
        slug,
      }),
    // Flags the question, or takes its flag off, and tells the student when the server refuses it.
    flag: (question) =>
      Effect.runPromise(
        mark({
          deviceId,
          flagged: !question.flagged,
          questionId: question.id,
          sittingId,
          slug,
        }).pipe(
          Effect.flatMap((failure) =>
            sittingCallFailures(Option.toArray(failure))
          )
        )
      ),
    paper,
  });

  return (
    <PlayerProvider
      keys={Arr.map(paper.questions, (question) => question.id)}
      mode={mode}
    >
      <PlayerKeys locked={locked} questions={questions} />
      <SittingLook attemptId={attemptId} deviceId={deviceId} slug={slug} />
      {header}
      <PlayerMain
        navigator={
          <PlayerSidebar>
            <PlayerGrid questions={questions} />
            <PlayerLegend />
          </PlayerSidebar>
        }
      >
        {locked ? <p>{t("student-locked")}</p> : null}
        <PlayerQuestions>
          {Arr.map(paper.questions, (question) => (
            <SittingQuestion
              attemptId={attemptId}
              deviceId={deviceId}
              key={question.id}
              locked={locked}
              question={question}
              sittingId={sittingId}
              slug={slug}
            />
          ))}
        </PlayerQuestions>
      </PlayerMain>
      <PlayerFooter>
        <PlayerFlag locked={locked} questions={questions} />
        <PlayerOpener />
      </PlayerFooter>
      <PlayerSheet>
        <PlayerGrid questions={questions} />
        <PlayerLegend />
      </PlayerSheet>
    </PlayerProvider>
  );
}
