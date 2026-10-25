import { type OptimisticLocalStore, useMutation } from "@confect/react";
import { LocalIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Clock, Effect, Option, Schema } from "effect";
import { sittingCallFailures } from "@/components/exams/sitting/actions";
import { finishAttempt } from "@/components/exams/sitting/attempt";
import { isFinalRefusal } from "@/components/exams/sitting/entry";
import { confirmAnswer, keepAnswer } from "@/components/exams/sitting/keep";
import {
  nextVersionOf,
  type PaperQuestion,
  type PaperValue,
  setPaperResponse,
} from "@/components/exams/sitting/paper";
import { sittingStorage } from "@/components/exams/sitting/storage";
import { reportClientException } from "@/lib/analytics/client";

/** The sitting and the school of one student's attempt, which every call names. */
const SittingKey = Schema.Struct({
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});

/** The key of one student's paper: the device that holds the attempt, and its sitting. */
const PaperKey = Schema.Struct({
  deviceId: Schema.String,
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});

/** Replaces the paper that the local store holds for one student, when the store holds it. */
export function changePaper(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  key: typeof PaperKey.Type,
  change: (paper: PaperValue) => PaperValue
) {
  const args = {
    deviceId: key.deviceId,
    sittingId: key.sittingId,
    slug: key.slug,
  };
  const current = Option.getOrUndefined(
    localStore.getQuery(exams.sittings.paper, args)
  );
  if (current !== undefined) {
    localStore.setQuery(
      exams.sittings.paper,
      args,
      Option.some(change(current))
    );
  }
}

/** Marks the student's attempt submitted in the local store, when the store holds it. */
function changeAttempt(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  key: typeof SittingKey.Type
) {
  const args = { sittingId: key.sittingId, slug: key.slug };
  const current = Option.getOrNull(
    localStore.getQuery(exams.sittings.student, args)
  );
  if (current !== null && current.attempt !== null) {
    localStore.setQuery(
      exams.sittings.student,
      args,
      Option.some({ ...current, attempt: finishAttempt(current.attempt) })
    );
  }
}

/** Saves one response at once: the screen shows the chosen option, and a refused answer rolls back. */
function useAnswer() {
  return useMutation(exams.sittings.answer).withOptimisticUpdate(
    (localStore, args) =>
      changePaper(localStore, args, (paper) =>
        setPaperResponse(paper, args.questionId, args.response, args.version)
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
  response: Schema.Array(LocalIdSchema),
  sittingId: Id("examSittings"),
  slug: TenantSlug,
  version: Version,
});
type SentAnswer = typeof SentAnswer.Type;

/**
 * Sends one answer, and settles the answer that the browser keeps for it once the server answers. A success
 * is confirmed, and so is a final refusal, such as a stale version, because the server will not take that
 * answer later either. A refusal for a lock, and any other failure, keeps the answer for the next visit to the
 * paper to send again.
 * The send resolves to the failure that the caller tells the student about, or to none when the server took
 * the answer, so each caller shows its failures with one toast.
 */
export function useSendAnswer() {
  const answer = useAnswer();

  return (input: SentAnswer, answeredAt: number) =>
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
      Effect.flatMap(Effect.fromResult),
      Effect.matchEffect({
        onSuccess: () =>
          confirmKept(input, answeredAt).pipe(Effect.as(Option.none())),
        onFailure: (error) =>
          (isFinalRefusal(error)
            ? confirmKept(input, answeredAt)
            : Effect.void
          ).pipe(Effect.as(Option.some(error))),
      })
    );
}

/** Drops the kept answer of one question, and reports a browser that refuses to keep it. */
function confirmKept(input: SentAnswer, answeredAt: number) {
  return confirmAnswer(
    input.sittingId,
    input.attemptId,
    input.questionId,
    answeredAt
  ).pipe(
    Effect.provide(sittingStorage),
    Effect.catchTag("KeyValueStoreError", (error) =>
      reportClientException(error, {
        source: "components/exams/sitting/answer",
      })
    )
  );
}

/** Finishes the student's attempt at once: the answers close, and a refused finish rolls back. */
export function useFinish() {
  return useMutation(exams.sittings.finish).withOptimisticUpdate(
    (localStore, args) => changeAttempt(localStore, args)
  );
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
    readonly response: readonly string[];
    readonly sittingId: typeof SentAnswer.Type.sittingId;
    readonly slug: TenantSlug;
  }) => {
    const answeredAt = Effect.runSync(Clock.currentTimeMillis);
    const version = nextVersionOf(input.question);
    Effect.runSync(
      keepAnswer(input.sittingId, input.attemptId, input.question.id, {
        answeredAt,
        response: input.response,
        version,
      }).pipe(
        Effect.provide(sittingStorage),
        Effect.catchTag("KeyValueStoreError", (error) =>
          reportClientException(error, {
            source: "components/exams/sitting/answer",
          })
        )
      )
    );
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
