"use server";

import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import {
  revalidateTryoutOverview,
  revalidateTryoutSet,
  type TryoutSetRouteInput,
} from "@/components/tryout/actions/revalidate";
import { fetchAuthMutation } from "@/lib/auth/server";

type StartPartArgs = FunctionArgs<
  typeof api.tryouts.mutations.attempts.startPart
>;

type CompletePartArgs = FunctionArgs<
  typeof api.tryouts.mutations.attempts.completePart
>;

type CompletePartErrorCode =
  | "TRYOUT_EXPIRED"
  | "TRYOUT_PART_EXPIRED"
  | "UNKNOWN";

/** Input required to start one tryout part and refresh its route family. */
export interface StartTryoutPartInput
  extends StartPartArgs,
    TryoutSetRouteInput {}

/** Result returned after attempting to start one tryout part. */
export type StartTryoutPartResult = { ok: true } | { ok: false };

/** Input required to complete one tryout part and refresh its route family. */
export interface CompleteTryoutPartInput
  extends CompletePartArgs,
    TryoutSetRouteInput {}

/** Result returned after attempting to complete one tryout part on the server. */
export type CompleteTryoutPartResult =
  | { ok: true }
  | { code: CompletePartErrorCode; ok: false };

/**
 * Starts one tryout part through Better Auth's official server utilities and
 * invalidates the tryout set routes that render its runtime state.
 */
export async function startTryoutPart({
  partKeys,
  ...args
}: StartTryoutPartInput): Promise<StartTryoutPartResult> {
  try {
    await fetchAuthMutation(api.tryouts.mutations.attempts.startPart, {
      partKey: args.partKey,
      tryoutAttemptId: args.tryoutAttemptId,
    });
  } catch {
    return { ok: false };
  }

  revalidateTryoutSet({
    locale: args.locale,
    partKeys,
    product: args.product,
    tryoutSlug: args.tryoutSlug,
  });

  return { ok: true };
}

/**
 * Normalizes Convex and runtime failures into the small set of UI error codes
 * the tryout flow already knows how to render.
 */
function getCompleteTryoutPartErrorCode(error: unknown): CompletePartErrorCode {
  if (error instanceof ConvexError) {
    const errorData = error.data;

    if (typeof errorData === "object" && errorData !== null) {
      const errorCode = "code" in errorData ? errorData.code : undefined;

      if (
        errorCode === "TRYOUT_EXPIRED" ||
        errorCode === "TRYOUT_PART_EXPIRED"
      ) {
        return errorCode;
      }
    }
  }

  return "UNKNOWN";
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
    await fetchAuthMutation(api.tryouts.mutations.attempts.completePart, {
      partKey: args.partKey,
      tryoutAttemptId: args.tryoutAttemptId,
    });
  } catch (error) {
    return { code: getCompleteTryoutPartErrorCode(error), ok: false };
  }

  revalidateTryoutOverview({
    locale: args.locale,
    product: args.product,
  });
  revalidateTryoutSet({
    locale: args.locale,
    partKeys,
    product: args.product,
    tryoutSlug: args.tryoutSlug,
  });

  return { ok: true };
}
