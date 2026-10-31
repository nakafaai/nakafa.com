import { useMutation } from "@confect/react";
import { NETWORK_RETRY_SCHEDULE } from "@repo/backend/client/network";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { ExamResponse } from "@repo/backend/confect/assessment/response";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Clock, Effect, Option, Schema } from "effect";
import { sittingCallFailures } from "@/components/exams/sitting/actions";
import { finishInStore } from "@/components/exams/sitting/attempt";
import { isFinalRefusal } from "@/components/exams/sitting/entry";
import { forgetKeptAttempt } from "@/components/exams/sitting/forget";
import { keptAttempt, keptFinish } from "@/components/exams/sitting/keep";
import {
  changeSaved,
  nextVersionOf,
  type PaperQuestion,
  setSavedResponse,
} from "@/components/exams/sitting/paper";
import { settleSent } from "@/components/player/keep";
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

/**
 * One answer that the student sends, with the attempt it answers and the version it is numbered with, which the
 * browser keeps until it is settled.
 */
const SentAnswer = Schema.Struct({
  attemptId: Id("examAttempts"),
  deviceId: Schema.String,
  questionId: Id("examQuestions"),
  response: ExamResponse,
  sittingId: Id("examSittings"),
  slug: TenantSlug,
  version: Version,
});
type SentAnswer = typeof SentAnswer.Type;

/**
 * Sends one answer, and settles the answer that the browser keeps for it once the server answers
 * (`settleSent`). A refusal is the server's answer, so it stays; a call that failed names no refusal, so the
 * same version goes again, because a server that failed for a moment must not lose a typed answer. The send
 * resolves to the failure that the caller tells the student about, or to none when the server took the
 * answer, so each caller shows its failures with one toast.
 */
export function useSendAnswer() {
  const answer = useAnswer();

  return (input: SentAnswer, answeredAt: number) =>
    settleSent(
      Effect.tryPromise(() =>
        answer({
          deviceId: input.deviceId,
          questionId: input.questionId,
          response: input.response,
          sittingId: input.sittingId,
          slug: input.slug,
          version: input.version,
        })
      ).pipe(
        Effect.retry(NETWORK_RETRY_SCHEDULE),
        Effect.flatMap(Effect.fromResult)
      ),
      confirmKept(input, answeredAt),
      isFinalRefusal
    );
}

/** Drops the kept answer of one question, and reports a browser that refuses to keep it. */
function confirmKept(input: SentAnswer, answeredAt: number) {
  return keptAttempt(input.sittingId, input.attemptId)
    .confirm(input.questionId, answeredAt)
    .pipe(
      Effect.provide(keptStorage),
      Effect.catchTag("KeyValueStoreError", (error) =>
        reportClientException(error, {
          source: "components/exams/sitting/answer",
        })
      )
    );
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

  return (input: {
    readonly attemptId: typeof SentAnswer.Type.attemptId;
    readonly deviceId: string;
    readonly sittingId: typeof SentAnswer.Type.sittingId;
    readonly slug: TenantSlug;
  }) => {
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
 * Keeps one response in the browser, numbered one above the saved version, and gives back the device time and
 * the version it was kept with. A typed answer is kept on every key, before its send waits for a pause, so a
 * reload or a closed tab loses no key; a later key keeps its text in place of the one kept before.
 */
export function keepResponse(input: {
  readonly attemptId: typeof SentAnswer.Type.attemptId;
  readonly question: PaperQuestion;
  readonly response: ExamResponse;
  readonly sittingId: typeof SentAnswer.Type.sittingId;
}) {
  const answeredAt = Effect.runSync(Clock.currentTimeMillis);
  const version = nextVersionOf(input.question);
  Effect.runSync(
    keptAttempt(input.sittingId, input.attemptId)
      .keep(input.question.id, {
        answeredAt,
        response: input.response,
        version,
      })
      .pipe(
        Effect.provide(keptStorage),
        Effect.catchTag("KeyValueStoreError", (error) =>
          reportClientException(error, {
            source: "components/exams/sitting/answer",
          })
        )
      )
  );
  return { answeredAt, version };
}

/**
 * Chooses one response for a question: it is kept in the browser before it is sent, numbered one above the
 * saved version, so a reload or a closed tab sends it again. The send confirms or drops the kept answer, and
 * a refused send shows its toast.
 */
export function useChooseAnswer() {
  const send = useSendAnswer();

  return (input: {
    readonly attemptId: typeof SentAnswer.Type.attemptId;
    readonly deviceId: string;
    readonly question: PaperQuestion;
    readonly response: ExamResponse;
    readonly sittingId: typeof SentAnswer.Type.sittingId;
    readonly slug: TenantSlug;
  }) => {
    const { answeredAt, version } = keepResponse(input);
    Effect.runPromise(
      send(
        {
          attemptId: input.attemptId,
          deviceId: input.deviceId,
          questionId: input.question.id,
          response: input.response,
          sittingId: input.sittingId,
          slug: input.slug,
          version,
        },
        answeredAt
      ).pipe(
        Effect.flatMap((failure) =>
          sittingCallFailures(Option.toArray(failure))
        )
      )
    );
  };
}
