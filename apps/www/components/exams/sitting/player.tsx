"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "next-intl";
import { runSittingCall } from "@/components/exams/sitting/actions.client";
import { useFinish } from "@/components/exams/sitting/answer.client";
import {
  type AttemptValue,
  isActive,
  secondsLeft,
} from "@/components/exams/sitting/attempt";
import { useSittingClock } from "@/components/exams/sitting/clock.client";
import { entryFailureMessage } from "@/components/exams/sitting/entry";
import { SittingFinish } from "@/components/exams/sitting/finish";
import { SittingQuestion } from "@/components/exams/sitting/question";
import { useSittingSignals } from "@/components/exams/sitting/signals.client";
import { PlayerMain } from "@/components/player/frame";
import { PlayerHeader, PlayerTitle } from "@/components/player/header";
import { PlayerProvider } from "@/components/player/provider";
import { PlayerQuestions } from "@/components/player/questions";
import { PlayerTimer } from "@/components/player/timer";

/**
 * The student's running attempt in the shared player: the exam's name, the time left, and the one
 * primary action in one row, then the questions. The signals run while the attempt is active.
 */
export function StudentPlayer({
  attempt,
  deviceId,
  sitting,
  slug,
}: {
  readonly attempt: AttemptValue;
  readonly deviceId: string;
  readonly sitting: typeof SittingView.Type;
  readonly slug: TenantSlug;
}) {
  const finish = useFinish();

  useSittingSignals({
    attemptId: attempt.id,
    deviceId,
    enabled: isActive(attempt.state),
    slug,
  });

  return (
    <>
      <PlayerHeader>
        <PlayerTitle>{sitting.examTitle}</PlayerTitle>
        {isActive(attempt.state) ? (
          <SittingTimer deadline={attempt.deadline} />
        ) : null}
        {isActive(attempt.state) ? (
          <SittingFinish
            locked={attempt.state !== "inProgress"}
            onFinish={() =>
              runSittingCall(() =>
                finish({ deviceId, sittingId: sitting.id, slug })
              )
            }
          />
        ) : null}
      </PlayerHeader>
      <PlayerMain navigator={null}>
        <StudentBody
          deviceId={deviceId}
          sittingId={sitting.id}
          slug={slug}
          state={attempt.state}
        />
      </PlayerMain>
    </>
  );
}

/**
 * An attempt that takes no answers, shown without an entry: the exam's name and the one
 * sentence of its state. A reload after a lock, a close, or a finish lands here, so the
 * student never loses how the attempt ended.
 */
export function StudentOutcome({
  attempt,
  sitting,
}: {
  readonly attempt: AttemptValue;
  readonly sitting: typeof SittingView.Type;
}) {
  return (
    <>
      <PlayerHeader>
        <PlayerTitle>{sitting.examTitle}</PlayerTitle>
      </PlayerHeader>
      <PlayerMain navigator={null}>
        {attempt.state === "inProgress" ? null : (
          <AttemptSentence state={attempt.state} />
        )}
      </PlayerMain>
    </>
  );
}

/** The copy key of each state of an attempt that takes no answers. */
const sentenceKeys = {
  closing: "student-attempt-closed",
  locked: "student-locked",
  submitted: "answers-in",
} satisfies Record<
  Exclude<AttemptValue["state"], "inProgress">,
  "answers-in" | "student-attempt-closed" | "student-locked"
>;

/** The one sentence of an attempt that takes no answers: locked, closing, or finished. */
function AttemptSentence({
  state,
}: {
  readonly state: Exclude<AttemptValue["state"], "inProgress">;
}) {
  const t = useTranslations("Exams");

  return <p>{t(sentenceKeys[state])}</p>;
}

/** The timer of the attempt, counted down on the device clock. */
function SittingTimer({ deadline }: { readonly deadline: number }) {
  const now = useSittingClock();

  return <PlayerTimer seconds={secondsLeft(deadline, now)} />;
}

/**
 * The questions of the paper while the attempt is open. Any other state shows one sentence in their
 * place, because the server takes no answer then: a lock, a closing, a finished attempt, or a paper
 * that the server refused.
 */
function StudentBody({
  deviceId,
  sittingId,
  slug,
  state,
}: {
  readonly deviceId: string;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
  readonly state: AttemptValue["state"];
}) {
  const t = useTranslations("Exams");
  const paper = useQuery(
    exams.sittings.paper,
    state === "inProgress" ? { deviceId, sittingId, slug } : "skip"
  );

  if (state !== "inProgress") {
    return <AttemptSentence state={state} />;
  }
  if (QueryResult.isFailure(paper)) {
    return (
      <p>
        {Option.match(entryFailureMessage(paper.error), {
          onNone: () => t("student-unavailable"),
          onSome: (message) => t(message),
        })}
      </p>
    );
  }
  if (!QueryResult.isSuccess(paper)) {
    return null;
  }

  // The shared list follows the question in view through the player's store, so the paper
  // gives it one, in the paper's order, and always as one list.
  return (
    <PlayerProvider
      keys={Arr.map(paper.value.questions, (question) => question.id)}
      mode="list"
    >
      <PlayerQuestions>
        {Arr.map(paper.value.questions, (question) => (
          <SittingQuestion
            deviceId={deviceId}
            key={question.id}
            question={question}
            sittingId={sittingId}
            slug={slug}
          />
        ))}
      </PlayerQuestions>
    </PlayerProvider>
  );
}
