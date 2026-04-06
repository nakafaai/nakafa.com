"use server";

import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { revalidatePath } from "next/cache";
import { fetchAuthMutation } from "@/lib/auth/server";

type CompletePartArgs = FunctionArgs<
  typeof api.tryouts.mutations.attempts.completePart
>;

type CompletePartErrorCode =
  | "TRYOUT_EXPIRED"
  | "TRYOUT_PART_EXPIRED"
  | "UNKNOWN";

/** Input required to complete one tryout part and refresh its destination route. */
export interface CompleteTryoutPartInput extends CompletePartArgs {
  redirectTo: string;
}

/** Result returned after attempting to complete one tryout part on the server. */
export type CompleteTryoutPartResult =
  | { ok: true }
  | { code: CompletePartErrorCode; ok: false };

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
 * invalidates the destination set route so the next navigation receives a
 * fresh server payload.
 */
export async function completeTryoutPart({
  redirectTo,
  ...args
}: CompleteTryoutPartInput): Promise<CompleteTryoutPartResult> {
  try {
    await fetchAuthMutation(api.tryouts.mutations.attempts.completePart, args);
    revalidatePath(redirectTo);

    return { ok: true };
  } catch (error) {
    return { code: getCompleteTryoutPartErrorCode(error), ok: false };
  }
}
