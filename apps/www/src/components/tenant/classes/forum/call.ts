import { toast } from "@repo/design-system/lib/toast/notify";
import { Data, Effect, type Result } from "effect";
import { classRefusalCopy } from "@/components/tenant/classes/refusals";
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
  onFailure: (error: E) => void
) =>
  Effect.runPromise(
    call.pipe(
      Effect.asVoid,
      Effect.catch((error) =>
        Effect.sync(() => onFailure(error)).pipe(
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

/** Says why a change of the class failed, in the toast every School action uses: the refusal's own copy, or the generic one. */
export const toastForumFailure = (error?: unknown) =>
  toast.error(classRefusalCopy(error));
