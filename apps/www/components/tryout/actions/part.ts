"use server";

import {
  captureServerException,
  extractDistinctIdFromPostHogCookie,
} from "@repo/analytics/posthog/server";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { cookies } from "next/headers";
import {
  revalidateTryoutOverview,
  revalidateTryoutSet,
  type TryoutSetRouteInput,
} from "@/components/tryout/actions/revalidate";
import { fetchAuthMutation } from "@/lib/auth/server";

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

/**
 * Starts one tryout part through Better Auth's official server utilities and
 * invalidates the tryout routes whenever the runtime state changed.
 */
export async function startTryoutPart({
  partKeys,
  ...args
}: StartTryoutPartInput): Promise<StartTryoutPartResult> {
  try {
    const result = await fetchAuthMutation(
      api.tryouts.mutations.attempts.startPart,
      {
        partKey: args.partKey,
        tryoutAttemptId: args.tryoutAttemptId,
      }
    );

    revalidateTryoutRoutes({
      locale: args.locale,
      partKeys,
      product: args.product,
      tryoutSlug: args.tryoutSlug,
    });

    return result;
  } catch (error) {
    await captureServerException(
      error,
      extractDistinctIdFromPostHogCookie((await cookies()).toString()),
      {
        locale: args.locale,
        part_key: args.partKey,
        product: args.product,
        source: "start-tryout-part",
        tryout_attempt_id: args.tryoutAttemptId,
        tryout_slug: args.tryoutSlug,
      }
    );

    return { kind: "unknown" };
  }
}

/**
 * Completes one tryout part through Better Auth's official server utilities and
 * invalidates the SSR route family that depends on the finished part state.
 */
export async function completeTryoutPart({
  partKeys,
  ...args
}: CompleteTryoutPartInput): Promise<CompleteTryoutPartResult> {
  try {
    const result = await fetchAuthMutation(
      api.tryouts.mutations.attempts.completePart,
      {
        partKey: args.partKey,
        tryoutAttemptId: args.tryoutAttemptId,
      }
    );

    revalidateTryoutRoutes({
      locale: args.locale,
      partKeys,
      product: args.product,
      tryoutSlug: args.tryoutSlug,
    });

    return result;
  } catch (error) {
    await captureServerException(
      error,
      extractDistinctIdFromPostHogCookie((await cookies()).toString()),
      {
        locale: args.locale,
        part_key: args.partKey,
        product: args.product,
        source: "complete-tryout-part",
        tryout_attempt_id: args.tryoutAttemptId,
        tryout_slug: args.tryoutSlug,
      }
    );

    return { kind: "unknown" };
  }
}
