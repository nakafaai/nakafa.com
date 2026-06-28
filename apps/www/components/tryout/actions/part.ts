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
import { fetchAuthMutation, requireAuth } from "@/lib/auth/server";

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
 * Starts one tryout part through Convex and invalidates the dependent Next
 * route family whenever the runtime state changed.
 */
const startTryoutPartMutation = Effect.fn("www.tryout.part.start")(function* ({
  partKeys,
  ...args
}: StartTryoutPartInput) {
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

/**
 * Next cache-invalidation seam for starting one tryout part.
 *
 * Convex owns the data validation, authorization, and transaction. This route
 * seam stays in Next because the successful mutation must invalidate cached
 * tryout pages.
 *
 * @see https://nextjs.org/docs/app/guides/authentication#server-actions
 * @see https://nextjs.org/docs/app/api-reference/functions/revalidatePath
 * @see https://nextjs.org/docs/app/guides/data-security#mutations
 */
export async function startTryoutPart(input: StartTryoutPartInput) {
  await requireAuth();

  return await Effect.runPromise(
    startTryoutPartMutation(input).pipe(
      Effect.catchAll((error) =>
        recoverTryoutPartError(error, input, "start-tryout-part")
      )
    )
  );
}

/**
 * Completes one tryout part through Convex and invalidates the Next route
 * family that depends on the finished part state.
 */
const completeTryoutPartMutation = Effect.fn("www.tryout.part.complete")(
  function* ({ partKeys, ...args }: CompleteTryoutPartInput) {
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

/**
 * Next cache-invalidation seam for completing one tryout part.
 *
 * Convex owns the data validation, authorization, and transaction. This route
 * seam stays in Next because the successful mutation must invalidate cached
 * tryout pages.
 *
 * @see https://nextjs.org/docs/app/guides/authentication#server-actions
 * @see https://nextjs.org/docs/app/api-reference/functions/revalidatePath
 * @see https://nextjs.org/docs/app/guides/data-security#mutations
 */
export async function completeTryoutPart(input: CompleteTryoutPartInput) {
  await requireAuth();

  return await Effect.runPromise(
    completeTryoutPartMutation(input).pipe(
      Effect.catchAll((error) =>
        recoverTryoutPartError(error, input, "complete-tryout-part")
      )
    )
  );
}
