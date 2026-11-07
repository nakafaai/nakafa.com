import { ExamInUse } from "@repo/backend/confect/exams/errors";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { Data, Effect, type Result, Schema } from "effect";
import { reportClientException } from "@/lib/analytics/client";

/** A call that did not complete at all: the network failed, or the call was rejected before the server answered. */
class ExamCallFailed extends Data.TaggedError("ExamCallFailed")<{
  readonly cause: unknown;
}> {}

/** The toast of a failed action: an exam that a sitting holds says so and what to do, and every other failure is the action error. */
const failureCopyOf = (error: unknown): ToastCopy =>
  Schema.is(ExamInUse)(error)
    ? {
        description: "exam-in-use.description",
        title: "exam-in-use.title",
      }
    : {
        description: "action-error.description",
        title: "action-error.title",
      };

/** What a call does with its answer: the value of a success, or the failure. */
interface Settle<A, E> {
  readonly onFailure: (error: E) => void;
  readonly onSuccess: (value: A) => void;
}

/**
 * The effect of one exam mutation: the call that Confect makes, with its typed answer read as
 * the effect's own failure. A refusal and a call that does not complete fail the same way,
 * so one handler settles both.
 */
export const sentAction = <A, E>(send: () => Promise<Result.Result<A, E>>) =>
  Effect.tryPromise({
    catch: (cause) => new ExamCallFailed({ cause }),
    try: send,
  }).pipe(Effect.flatMap(Effect.fromResult));

/**
 * Runs one exam action from a browser event, and settles it. A success hands its value to
 * `onSuccess`. A failure is reported, `onFailure` takes it, and its toast shows: why a sitting
 * keeps an exam, or the action error.
 * Convex removes the optimistic change of a failed call by itself, so `onFailure` only
 * restores what the page keeps outside the Convex store. No failure is left unhandled.
 */
export const runExamAction = <A, E>(
  action: Effect.Effect<A, E>,
  settle: Settle<A, E>
) =>
  Effect.runPromise(
    action.pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          reportClientException(error, {
            source: "components/tenant/exams/action",
          }).pipe(
            Effect.andThen(
              Effect.sync(() => {
                settle.onFailure(error);
                toast.error(failureCopyOf(error));
              })
            )
          ),
        onSuccess: (value) => Effect.sync(() => settle.onSuccess(value)),
      })
    )
  );
