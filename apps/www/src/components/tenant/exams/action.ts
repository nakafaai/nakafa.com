import { toast } from "@repo/design-system/lib/toast/notify";
import { Data, Effect, type Result } from "effect";
import { reportClientException } from "@/lib/analytics/client";

/** A call that did not complete at all: the network failed, or the call was rejected before the server answered. */
class ExamCallFailed extends Data.TaggedError("ExamCallFailed")<{
  readonly cause: unknown;
}> {}

/** What a call does with its answer: the value of a success, or nothing on a failure. */
interface Settle<A> {
  readonly onFailure: () => void;
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
 * `onSuccess`. A failure is reported, `onFailure` runs, and the action-error toast shows.
 * Convex removes the optimistic change of a failed call by itself, so `onFailure` only
 * restores what the page keeps outside the Convex store. No failure is left unhandled.
 */
export const runExamAction = <A, E>(
  action: Effect.Effect<A, E>,
  settle: Settle<A>
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
                settle.onFailure();
                toast.error({
                  description: "action-error.description",
                  title: "action-error.title",
                });
              })
            )
          ),
        onSuccess: (value) => Effect.sync(() => settle.onSuccess(value)),
      })
    )
  );
