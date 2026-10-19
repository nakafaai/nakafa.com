"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { runSittingCall } from "@/components/exams/sitting/actions.client";
import { useFinish } from "@/components/exams/sitting/answer.client";
import {
  type AttemptValue,
  isActive,
  secondsLeft,
  takesAnswers,
} from "@/components/exams/sitting/attempt";
import { SittingBar } from "@/components/exams/sitting/bar";
import { serverTime } from "@/components/exams/sitting/clock";
import { useSittingClock } from "@/components/exams/sitting/clock.client";
import { sittingFailureMessage } from "@/components/exams/sitting/entry";
import { SittingFinish } from "@/components/exams/sitting/finish";
import { SittingFlagProvider } from "@/components/exams/sitting/flags.client";
import { forgetKeptAttempt } from "@/components/exams/sitting/forget.client";
import { useResendKeptAnswers } from "@/components/exams/sitting/kept.client";
import { SittingNavigator } from "@/components/exams/sitting/navigator";
import type { PaperValue } from "@/components/exams/sitting/paper";
import { SittingQuestion } from "@/components/exams/sitting/question";
import { SittingRetry } from "@/components/exams/sitting/retry";
import { useSittingSignals } from "@/components/exams/sitting/signals.client";
import { PlayerFooter, PlayerOpener } from "@/components/player/footer";
import { PlayerMain } from "@/components/player/frame";
import { PlayerSheet } from "@/components/player/navigator/sheet";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerProvider } from "@/components/player/provider";
import { PlayerQuestions } from "@/components/player/questions";
import { PlayerTimer } from "@/components/player/timer";

/**
 * The student's running attempt in the shared player: the school's header with the exam's name, the time
 * left, and the one primary action, then the paper with its navigator. A locked attempt shows the same
 * header, with the lock's sentence in place of the paper. The signals run while the attempt is active.
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
  const finish = useFinish();
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
  const finishing = isActive(attempt.state) ? (
    <SittingFinish
      locked={!takesAnswers(attempt.state)}
      onFinish={() =>
        runSittingCall(
          () => finish({ deviceId, sittingId, slug }),
          () => {
            forgetKeptAttempt(sittingId, attempt.id);
          }
        )
      }
    />
  ) : null;

  if (QueryResult.isSuccess(paper) && takesAnswers(attempt.state)) {
    return (
      <RunningPaper
        attemptId={attempt.id}
        deviceId={deviceId}
        header={
          <SittingBar examTitle={sitting.examTitle}>
            {timer}
            {finishing}
            <PlayerOpener />
          </SittingBar>
        }
        paper={paper.value}
        sittingId={sittingId}
        slug={slug}
      />
    );
  }

  return (
    <>
      <SittingBar examTitle={sitting.examTitle}>
        {timer}
        {finishing}
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
    </>
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
 * The paper of an open attempt. The flags and the navigator follow the paper, the answers the student
 * sends are kept until the server confirms them, and the kept answers of an earlier visit are sent again
 * once the paper is on the screen.
 */
function RunningPaper({
  attemptId,
  deviceId,
  header,
  paper,
  sittingId,
  slug,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
  readonly deviceId: string;
  readonly header: ReactNode;
  readonly paper: PaperValue;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  useResendKeptAnswers({ attemptId, deviceId, paper, sittingId, slug });

  return (
    <SittingFlagProvider attemptId={attemptId} sittingId={sittingId}>
      <PlayerProvider
        keys={Arr.map(paper.questions, (question) => question.id)}
        mode="list"
      >
        {header}
        <PlayerMain
          navigator={
            <PlayerSidebar>
              <SittingNavigator questions={paper.questions} />
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
        </PlayerSheet>
      </PlayerProvider>
    </SittingFlagProvider>
  );
}
