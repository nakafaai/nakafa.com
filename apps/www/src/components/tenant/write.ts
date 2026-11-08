import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { Data, Effect, type Result } from "effect";
import { refusalCopy } from "@/components/tenant/refusal/copy";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The module every School write reports from. Each report also carries the page it happened on and the failure's own
 * tag, which together name the write, so no caller restates its module.
 */
const SOURCE = "components/tenant/write";

/** A School call that did not complete at all: the network failed, or the call was rejected before the server answered. */
export class SchoolCallFailed extends Data.TaggedError("SchoolCallFailed")<{
  readonly cause: unknown;
}> {}

/**
 * The effect of one School mutation: the call Confect makes, with its typed refusal read as the effect's own failure,
 * so a refusal and a call that does not complete fail the same way.
 */
export const schoolCall = <A, E>(send: () => Promise<Result.Result<A, E>>) =>
  Effect.tryPromise({
    catch: (cause) => new SchoolCallFailed({ cause }),
    try: send,
  }).pipe(Effect.flatMap(Effect.fromResult));

/** Reports a failure after the page has said why, so a reporter that fails hides nothing. */
const reported = (error: unknown) =>
  reportClientException(error, { source: SOURCE }).pipe(
    Effect.catchDefect(() => Effect.void)
  );

/**
 * Says why a School action failed, in the toast every School action uses, and then reports it: the copy the action
 * names, such as a file that could not be saved, or the refusal's own.
 */
export const failSchoolAction = (
  error: unknown,
  copy: ToastCopy = refusalCopy(error)
) =>
  Effect.sync(() => {
    toast.error(copy);
  }).pipe(Effect.andThen(reported(error)));

/** What a write does when it settles. */
interface Settle<A, E> {
  /** Restores what the page keeps outside the store, such as a draft or an open dialog, on any failure. */
  readonly onFailed?: ((error: E) => void) | undefined;
  /** Takes the place of the toast: the page shows the refusal itself, in a dialog or as an unsent message. */
  readonly onRefused?: ((copy: ToastCopy) => void) | undefined;
  /** Takes the answer of a write the server kept. */
  readonly onSaved?: ((value: A) => void) | undefined;
}

/**
 * Runs one School write from a browser event. The call starts one turn later: most callers run this in a transition,
 * and React holds every store update made in a transition's first turn until its action ends, so an optimistic change
 * made there would wait for the server's answer. A success hands its answer to `onSaved`. A failure runs `onFailed`,
 * then says why, in the refusal's own copy through `onRefused` or a toast, and only then is reported, so a reporter that
 * fails hides nothing. Convex removes the optimistic change of a failed call by itself. No failure is left unhandled.
 */
export const runSchoolWrite = <A, E>(
  call: Effect.Effect<A, E>,
  settle: Settle<A, E | SchoolCallFailed> = {}
) =>
  Effect.runPromise(
    Effect.yieldNow.pipe(
      Effect.andThen(call),
      Effect.matchEffect({
        onFailure: (error) =>
          Effect.sync(() => {
            settle.onFailed?.(error);
            const copy = refusalCopy(error);
            if (settle.onRefused === undefined) {
              toast.error(copy);
              return;
            }
            settle.onRefused(copy);
          }).pipe(Effect.andThen(reported(error))),
        onSuccess: (value) => Effect.sync(() => settle.onSaved?.(value)),
      })
    )
  );
