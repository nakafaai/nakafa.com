import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { useChooseAnswer } from "@/components/exams/sitting/answer";
import {
  type AttemptValue,
  isActive,
  secondsLeft,
  takesAnswers,
} from "@/components/exams/sitting/attempt";
import { PaperBack, PaperBar } from "@/components/exams/sitting/bar";
import { serverTime } from "@/components/exams/sitting/clock";
import {
  isRetiredDevice,
  sittingFailureMessage,
} from "@/components/exams/sitting/entry";
import {
  useFinishAttempt,
  useResendKeptAnswers,
} from "@/components/exams/sitting/kept";
import { PaperLockProvider } from "@/components/exams/sitting/lock";
import { SittingLook } from "@/components/exams/sitting/look";
import { useFlagQuestion } from "@/components/exams/sitting/mark";
import { useSittingMode } from "@/components/exams/sitting/mode";
import { mergePaper, type PaperValue } from "@/components/exams/sitting/paper";
import {
  PaperReveal,
  SittingQuestion,
} from "@/components/exams/sitting/question";
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
import { PlayerGrid } from "@/components/player/navigator/grid";
import { PlayerLegend } from "@/components/player/navigator/legend";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerProvider } from "@/components/player/provider";
import { PlayerQuestions } from "@/components/player/questions";
import { PlayerTimer } from "@/components/player/timer";

/** The error of a query that failed, or none while it loads or once it answered. */
function failureOf<A, E>(result: QueryResult.QueryResult<A, E>) {
  return QueryResult.isFailure(result)
    ? Option.some(result.error)
    : Option.none();
}

/**
 * The student's running attempt in the shared player, full screen: the player's header with the way back,
 * the exam's name, the time left, and the one primary action, then the paper with its navigator, its keys,
 * and its view. A locked
 * attempt keeps the same header and navigator, and its paper reads only, with the lock's sentence above it.
 * The signals run while the attempt is active.
 */
export function StudentPlayer({
  admission,
  attempt,
  sitting,
  slug,
}: {
  /** The device the student was admitted on, and its clock's offset from the server's. */
  readonly admission: {
    readonly clockOffset: number;
    readonly deviceId: string;
  };
  readonly attempt: AttemptValue;
  readonly sitting: typeof SittingView.Type;
  readonly slug: TenantSlug;
}) {
  const { clockOffset, deviceId } = admission;
  const t = useTranslations("Exams");
  const mode = useSittingMode();
  const sittingId = sitting.id;

  useSittingSignals({
    attemptId: attempt.id,
    deviceId,
    enabled: isActive(attempt.state),
    slug,
  });

  // The paper's questions and what the student saved on them are read apart, so an answer reads again only the latter.
  const paperArgs = isActive(attempt.state)
    ? { deviceId, sittingId, slug }
    : "skip";
  const paperResult = useQuery(exams.sittings.paper, paperArgs);
  const savedResult = useQuery(exams.sittings.saved, paperArgs);
  if (
    QueryResult.isSuccess(paperResult) &&
    QueryResult.isSuccess(savedResult) &&
    isActive(attempt.state)
  ) {
    const paper = mergePaper(paperResult.value, savedResult.value);
    return (
      <RunningPaper
        attemptId={attempt.id}
        deviceId={deviceId}
        header={
          <PaperBar
            back={<PaperBack />}
            timer={
              <SittingTimer
                clockOffset={clockOffset}
                deadline={attempt.deadline}
              />
            }
            title={sitting.examTitle}
          >
            <StudentFinish
              attempt={attempt}
              deviceId={deviceId}
              paper={paper}
              sittingId={sittingId}
              slug={slug}
            />
          </PaperBar>
        }
        locked={!takesAnswers(attempt.state)}
        mode={mode}
        paper={paper}
        sittingId={sittingId}
        slug={slug}
      />
    );
  }

  // Both reads pass the same gate, so either one's refusal is the attempt's.
  const failure = Option.orElse(failureOf(paperResult), () =>
    failureOf(savedResult)
  );
  // A retired device holds the attempt no more, so its bar keeps the time and offers no Finish.
  const retired = Option.exists(failure, isRetiredDevice);

  return (
    <PlayerProvider keys={[]} mode={mode}>
      <PaperBar
        back={<PaperBack />}
        timer={
          isActive(attempt.state) ? (
            <SittingTimer
              clockOffset={clockOffset}
              deadline={attempt.deadline}
            />
          ) : undefined
        }
        title={sitting.examTitle}
      >
        {isActive(attempt.state) && !retired ? (
          <StudentFinish
            attempt={attempt}
            deviceId={deviceId}
            paper={null}
            sittingId={sittingId}
            slug={slug}
          />
        ) : null}
      </PaperBar>
      <PlayerMain navigator={null}>
        {Option.match(failure, {
          onNone: () => null,
          onSome: (error) =>
            Option.match(sittingFailureMessage(error), {
              onNone: () => <SittingRetry error={error} />,
              onSome: (message) => <p>{t(message)}</p>,
            }),
        })}
      </PlayerMain>
    </PlayerProvider>
  );
}

/**
 * The student's one primary action, which a lock of the attempt holds closed. It reviews the flagged and the
 * unanswered questions of the paper before the answers close, and it exists only while the attempt is active.
 */
function StudentFinish({
  attempt,
  deviceId,
  paper,
  sittingId,
  slug,
}: {
  readonly attempt: AttemptValue;
  readonly deviceId: string;
  /** The paper on the screen, or none while it is not, which leaves nothing to review. */
  readonly paper: PaperValue | null;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const tTryouts = useTranslations("Tryouts");
  const finish = useFinishAttempt({
    attemptId: attempt.id,
    deviceId,
    paper,
    sittingId,
    slug,
  });

  return (
    <PlayerFinish
      description={t("finish-description")}
      label={tTryouts("complete-part-cta")}
      locked={!takesAnswers(attempt.state)}
      onFinish={finish}
      pending={false}
      questions={paper === null ? [] : projectSittingCells(paper)}
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
  const flagQuestion = useFlagQuestion({ deviceId, sittingId, slug });
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
    flag: flagQuestion,
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
        <PaperLockProvider locked={locked}>
          <PaperReveal
            deviceId={deviceId}
            paper={paper}
            sittingId={sittingId}
            slug={slug}
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
          </PaperReveal>
        </PaperLockProvider>
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
