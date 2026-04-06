"use server";

import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import {
  revalidateTryoutOverview,
  revalidateTryoutSet,
  type TryoutSetRouteInput,
} from "@/components/tryout/actions/revalidate";
import { env } from "@/env";
import { fetchAuthAction, fetchAuthMutation } from "@/lib/auth/server";

type StartTryoutArgs = FunctionArgs<
  typeof api.tryouts.mutations.attempts.startTryout
>;

type StartTryoutErrorCode =
  | "COMPETITION_ATTEMPT_ALREADY_USED"
  | "TRYOUT_ACCESS_REQUIRED"
  | "UNKNOWN";

/** Input required to start one tryout attempt and refresh its route family. */
export interface StartTryoutInput extends StartTryoutArgs, TryoutSetRouteInput {
  returnPath: string;
}

/** Result returned after attempting to start one tryout attempt. */
export type StartTryoutResult =
  | { ok: true }
  | { code: "COMPETITION_ATTEMPT_ALREADY_USED" | "UNKNOWN"; ok: false }
  | { code: "TRYOUT_ACCESS_REQUIRED"; ok: false; url: string };

/** Maps one thrown error into the limited set of UI-facing start codes. */
function getStartTryoutErrorCode(error: unknown): StartTryoutErrorCode {
  if (error instanceof ConvexError) {
    const errorData = error.data;

    if (typeof errorData === "object" && errorData !== null) {
      const errorCode = "code" in errorData ? errorData.code : undefined;

      if (
        errorCode === "COMPETITION_ATTEMPT_ALREADY_USED" ||
        errorCode === "TRYOUT_ACCESS_REQUIRED"
      ) {
        return errorCode;
      }
    }
  }

  return "UNKNOWN";
}

/** Builds a trusted absolute checkout return URL from one internal app path. */
function getCheckoutSuccessUrl(returnPath: string) {
  if (!returnPath.startsWith("/") || returnPath.startsWith("//")) {
    return null;
  }

  return new URL(returnPath, env.SITE_URL).toString();
}

/** Creates the checkout URL used when the tryout requires paid access. */
async function getCheckoutUrl(returnPath: string) {
  const successUrl = getCheckoutSuccessUrl(returnPath);

  if (!successUrl) {
    return null;
  }

  try {
    const result = await fetchAuthAction(
      api.customers.actions.public.generateCheckoutLink,
      {
        productIds: [products.pro.id],
        successUrl,
      }
    );

    return result.url;
  } catch {
    return null;
  }
}

/**
 * Starts one tryout attempt through Better Auth's official server helpers and
 * invalidates the SSR route family that depends on the new attempt state.
 */
export async function startTryout({
  partKeys,
  returnPath,
  ...args
}: StartTryoutInput): Promise<StartTryoutResult> {
  try {
    await fetchAuthMutation(api.tryouts.mutations.attempts.startTryout, args);
  } catch (error) {
    const errorCode = getStartTryoutErrorCode(error);

    if (errorCode === "COMPETITION_ATTEMPT_ALREADY_USED") {
      return { code: errorCode, ok: false };
    }

    if (errorCode !== "TRYOUT_ACCESS_REQUIRED") {
      return { code: "UNKNOWN", ok: false };
    }

    const checkoutUrl = await getCheckoutUrl(returnPath);

    if (!checkoutUrl) {
      return { code: "UNKNOWN", ok: false };
    }

    return {
      code: "TRYOUT_ACCESS_REQUIRED",
      ok: false,
      url: checkoutUrl,
    };
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
