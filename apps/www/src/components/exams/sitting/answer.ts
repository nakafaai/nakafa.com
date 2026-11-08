import type { GenericId } from "@confect/core";
import { useMutation } from "@confect/react";
import { NETWORK_RETRY_SCHEDULE } from "@repo/backend/client/network";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import { sittingCallFailures } from "@/components/exams/sitting/actions";
import { finishInStore } from "@/components/exams/sitting/attempt";
import {
  answerRefusalOf,
  failureCopyOf,
} from "@/components/exams/sitting/entry";
import { forgetKeptAttempt } from "@/components/exams/sitting/forget";
import { keptAttempt, keptFinish } from "@/components/exams/sitting/keep";
import {
  changeSaved,
  nextVersionOf,
  type PaperQuestion,
  setSavedResponse,
} from "@/components/exams/sitting/paper";
import { keptStorage } from "@/components/player/storage";
import { reportClientException } from "@/lib/analytics/client";

/** Saves one response at once: the screen shows the chosen option or the typed text, and a refused answer rolls back. */
function useAnswer() {
  return useMutation(exams.sittings.answer).withOptimisticUpdate(
    (localStore, args) =>
      changeSaved(localStore, args, (saved) =>
        setSavedResponse(saved, args.questionId, args.response, args.version)
      )
  );
}

/** The attempt an answer goes to and the device that sends it, which name its kept entry and its save. */
const AnswerTarget = Schema.Struct({
  attemptId: Id("examAttempts"),
  deviceId: Schema.String,
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});
type AnswerTarget = typeof AnswerTarget.Type;

/**
 * The ledger of one attempt's kept answers, bound to the save of an answer from this device. A refusal is the
 * server's answer (`answerRefusalOf`); a call that failed names no refusal, so the same version goes again on the
 * network schedule, because a server that failed for a moment must not lose a typed answer.
 */
export function useAnswerLedger() {
  const answer = useAnswer();

  return (target: AnswerTarget) =>
    keptAttempt(target.sittingId, target.attemptId).bind({
      copyOf: failureCopyOf,
      refusal: answerRefusalOf,
      send: (questionId: GenericId.GenericId<"examQuestions">, kept) =>
        Effect.tryPromise(() =>
          answer({
            deviceId: target.deviceId,
            questionId,
            response: kept.response,
            sittingId: target.sittingId,
            slug: target.slug,
            version: kept.version,
          })
        ).pipe(
          Effect.retry(NETWORK_RETRY_SCHEDULE),
          Effect.flatMap(Effect.fromResult)
        ),
      source: "components/exams/sitting/answer",
    });
}

/** Finishes the student's attempt at once: the answers close, and a refused finish rolls back. */
function useFinish() {
  return useMutation(exams.sittings.finish).withOptimisticUpdate(
    (localStore, args) => finishInStore(localStore, args)
  );
}

/** Runs one step of the kept Finish, and reports a browser that refuses it, since the Finish goes either way. */
function onKeptFinish(step: ReturnType<ReturnType<typeof keptFinish>["keep"]>) {
  return step.pipe(
    Effect.provide(keptStorage),
    Effect.catchTag("KeyValueStoreError", (error) =>
      reportClientException(error, {
        source: "components/exams/sitting/answer",
      })
    )
  );
}

/**
 * Sends the student's Finish, kept in the browser while it is on its way (`keptFinish`). The screen shows the finish
 * at once, so a page closed on a slow network must not lose it. A call that failed names no refusal, so it goes
 * again, and a second Finish changes nothing on the server. Any answer the page hears ends the keeping: a confirmed
 * Finish forgets all the browser holds for the attempt, and a failed one tells the student, who presses again.
 */
export function useSendFinish() {
  const finish = useFinish();

  return (input: AnswerTarget) => {
    const kept = keptFinish(input.sittingId, input.attemptId);

    return onKeptFinish(kept.keep()).pipe(
      Effect.andThen(
        Effect.tryPromise(() =>
          finish({
            deviceId: input.deviceId,
            sittingId: input.sittingId,
            slug: input.slug,
          })
        ).pipe(
          Effect.retry(NETWORK_RETRY_SCHEDULE),
          Effect.flatMap(Effect.fromResult)
        )
      ),
      Effect.matchEffect({
        onFailure: (error) =>
          onKeptFinish(kept.drop()).pipe(
            Effect.andThen(sittingCallFailures([error]))
          ),
        onSuccess: () =>
          Effect.sync(() => {
            forgetKeptAttempt(input.sittingId, input.attemptId);
          }),
      })
    );
  };
}

/**
 * Keeps one response in the browser, numbered one above the saved version. A typed answer is kept on every key,
 * before its send waits for a pause, so a reload or a closed tab loses no key; a later key keeps its text in place
 * of the one kept before.
 */
export function keepResponse(input: {
  readonly attemptId: AnswerTarget["attemptId"];
  readonly question: PaperQuestion;
  readonly response: ExamResponse;
  readonly sittingId: AnswerTarget["sittingId"];
}) {
  Effect.runSync(
    keptAttempt(input.sittingId, input.attemptId)
      .keep(input.question.id, {
        response: input.response,
        version: nextVersionOf(input.question),
      })
      .pipe(
        Effect.asVoid,
        Effect.provide(keptStorage),
        Effect.catchTag("KeyValueStoreError", (error) =>
          reportClientException(error, {
            source: "components/exams/sitting/answer",
          })
        )
      )
  );
}

/**
 * Chooses one response for a question: it is kept in the browser before it is sent, numbered one above the
 * saved version, so a reload or a closed tab sends it again. The fiber keeps it before the press returns, the
 * send confirms or drops the kept answer, and a refused send shows its toast.
 */
export function useChooseAnswer() {
  const ledgerOf = useAnswerLedger();

  return (
    input: AnswerTarget & {
      readonly question: PaperQuestion;
      readonly response: ExamResponse;
    }
  ) => {
    Effect.runFork(
      ledgerOf(input)
        .choose(input.question.id, {
          response: input.response,
          version: nextVersionOf(input.question),
        })
        .pipe(Effect.provide(keptStorage))
    );
  };
}
