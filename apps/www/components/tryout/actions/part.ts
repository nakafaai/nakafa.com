"use server";

import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import {
  revalidateTryoutOverview,
  revalidateTryoutSet,
  type TryoutSetRouteInput,
} from "@/components/tryout/actions/revalidate";
import { scheduleCurrentServerExceptionCapture } from "@/lib/analytics/server";
import {
  AuthenticationRequiredError,
  fetchAuthMutation,
  requireAuth,
} from "@/lib/auth/server";

type StartPartArgs = FunctionArgs<
  typeof api.tryouts.mutations.attempts.startPart
>;
type StartPartMutationResult = FunctionReturnType<
  typeof api.tryouts.mutations.attempts.startPart
>;
type CompletePartArgs = FunctionArgs<
  typeof api.tryouts.mutations.attempts.completePart
>;
type CompletePartMutationResult = FunctionReturnType<
  typeof api.tryouts.mutations.attempts.completePart
>;

/** Input required to start one tryout part and refresh its route family. */
export interface StartTryoutPartInput
  extends StartPartArgs,
    TryoutSetRouteInput {}

/** Result returned after attempting to start one tryout part. */
export type StartTryoutPartResult =
  | StartPartMutationResult
  | { kind: "unknown" };

/** Input required to complete one tryout part and refresh its route family. */
export interface CompleteTryoutPartInput
  extends CompletePartArgs,
    TryoutSetRouteInput {}

/** Result returned after attempting to complete one tryout part on the server. */
export type CompleteTryoutPartResult =
  | CompletePartMutationResult
  | { kind: "unknown" };

const unknownTryoutPartResult = { kind: "unknown" } as const;

/** Revalidates the tryout routes that depend on one attempt's live runtime state. */
function revalidateTryoutRoutes({
  locale,
  partKeys,
  product,
  tryoutSlug,
}: TryoutSetRouteInput) {
  revalidateTryoutOverview({
    locale,
    product,
  });
  revalidateTryoutSet({
    locale,
    partKeys,
    product,
    tryoutSlug,
  });
}

/** Records unexpected part action failures and returns the safe public fallback. */
function recoverTryoutPartError(
  error: unknown,
  args: StartTryoutPartInput | CompleteTryoutPartInput,
  source: string
) {
  if (error instanceof AuthenticationRequiredError) {
    return Effect.succeed(unknownTryoutPartResult);
  }

  return Effect.sync(() => {
    scheduleCurrentServerExceptionCapture(error, {
      locale: args.locale,
      part_key: args.partKey,
      product: args.product,
      source,
      tryout_attempt_id: args.tryoutAttemptId,
      tryout_slug: args.tryoutSlug,
    });

    return unknownTryoutPartResult;
  });
}

/**
 * Starts one tryout part through Better Auth's official server utilities and
 * invalidates the tryout routes whenever the runtime state changed.
 */
const startTryoutPartEffect = Effect.fn("www.tryout.part.start")(function* ({
  partKeys,
  ...args
}: StartTryoutPartInput) {
  yield* Effect.tryPromise({
    try: () => requireAuth(),
    catch: (error) => error,
  });

  const result = yield* Effect.tryPromise({
    try: () =>
      fetchAuthMutation(api.tryouts.mutations.attempts.startPart, {
        partKey: args.partKey,
        tryoutAttemptId: args.tryoutAttemptId,
      }),
    catch: (error) => error,
  });

  revalidateTryoutRoutes({
    locale: args.locale,
    partKeys,
    product: args.product,
    tryoutSlug: args.tryoutSlug,
  });

  return result;
});

export async function startTryoutPart(
  input: StartTryoutPartInput
): Promise<StartTryoutPartResult> {
  return await Effect.runPromise(
    startTryoutPartEffect(input).pipe(
      Effect.catchAll((error) =>
        recoverTryoutPartError(error, input, "start-tryout-part")
      )
    )
  );
}

/**
 * Completes one tryout part through Better Auth's official server utilities and
 * invalidates the SSR route family that depends on the finished part state.
 */
const completeTryoutPartEffect = Effect.fn("www.tryout.part.complete")(
  function* ({ partKeys, ...args }: CompleteTryoutPartInput) {
    yield* Effect.tryPromise({
      try: () => requireAuth(),
      catch: (error) => error,
    });

    const result = yield* Effect.tryPromise({
      try: () =>
        fetchAuthMutation(api.tryouts.mutations.attempts.completePart, {
          partKey: args.partKey,
          tryoutAttemptId: args.tryoutAttemptId,
        }),
      catch: (error) => error,
    });

    revalidateTryoutRoutes({
      locale: args.locale,
      partKeys,
      product: args.product,
      tryoutSlug: args.tryoutSlug,
    });

    return result;
  }
);

export async function completeTryoutPart(
  input: CompleteTryoutPartInput
): Promise<CompleteTryoutPartResult> {
  return await Effect.runPromise(
    completeTryoutPartEffect(input).pipe(
      Effect.catchAll((error) =>
        recoverTryoutPartError(error, input, "complete-tryout-part")
      )
    )
  );
}
