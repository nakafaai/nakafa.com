import { toast } from "@repo/design-system/lib/toast/notify";
import { Data, Effect, type Result } from "effect";
import { reportClientException } from "@/lib/analytics/client";

/** A forum call that did not complete at all: the network failed, or the call was rejected before the server answered. */
class ForumCallFailed extends Data.TaggedError("ForumCallFailed")<{
  readonly cause: unknown;
}> {}

/**
 * The effect of one forum mutation: the call that Confect makes, with its typed answer read as
 * the effect's own failure, so a refusal and a call that does not complete fail the same way.
 */
export const forumCall = <A, E>(send: () => Promise<Result.Result<A, E>>) =>
  Effect.tryPromise({
    catch: (cause) => new ForumCallFailed({ cause }),
    try: send,
  }).pipe(Effect.flatMap(Effect.fromResult));

/**
 * Runs one forum call from a browser event. On a failure `onFailure` runs first, so the page always says what failed,
 * and the failure is reported after it: Convex removes the optimistic change of a failed call by itself, so
 * `onFailure` only restores what the page keeps outside the store, or says what failed. A reporter that fails
 * cannot hide the failure. No failure is left unhandled.
 */
export const runForumCall = <A, E>(
  call: Effect.Effect<A, E>,
  onFailure: () => void
) =>
  Effect.runPromise(
    call.pipe(
      Effect.asVoid,
      Effect.catch((error) =>
        Effect.sync(onFailure).pipe(
          Effect.andThen(
            reportClientException(error, {
              source: "components/tenant/classes/forum",
            })
          ),
          Effect.catchDefect(() => Effect.void)
        )
      )
    )
  );

/** Says that a change of the forum failed, in the toast every School action uses. */
export const toastForumFailure = () =>
  toast.error({
    description: "action-error.description",
    title: "action-error.title",
  });
