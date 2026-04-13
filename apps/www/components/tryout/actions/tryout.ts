"use server";

import { captureServerException } from "@repo/analytics/posthog/server";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import { getPathname } from "@repo/internationalization/src/navigation";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import {
  revalidateTryoutOverview,
  revalidateTryoutSet,
  type TryoutSetRouteInput,
} from "@/components/tryout/actions/revalidate";
import { env } from "@/env";
import { fetchAuthAction, fetchAuthMutation } from "@/lib/auth/server";
import { getSafeInternalRedirectPath } from "@/lib/auth/utils";

type StartTryoutArgs = FunctionArgs<
  typeof api.tryouts.mutations.attempts.startTryout
>;
type StartTryoutMutationResult = FunctionReturnType<
  typeof api.tryouts.mutations.attempts.startTryout
>;

/** Input required to start one tryout attempt and refresh its route family. */
export interface StartTryoutInput extends StartTryoutArgs, TryoutSetRouteInput {
  returnPath: string;
}

/** Result returned after attempting to start one tryout attempt. */
export type StartTryoutResult =
  | { kind: "started" }
  | { kind: "competition-attempt-used" }
  | { kind: "requires-access"; url: string }
  | { kind: "not-ready" }
  | { kind: "inactive" }
  | { kind: "not-found" }
  | { kind: "unknown" };

/** Builds a trusted absolute checkout return URL from one localized app path. */
function getCheckoutSuccessUrl({
  locale,
  returnPath,
}: {
  locale: StartTryoutInput["locale"];
  returnPath: string;
}) {
  const safeReturnPath = getSafeInternalRedirectPath(returnPath);

  if (!safeReturnPath) {
    return null;
  }

  const localizedPath = getPathname({
    href: safeReturnPath,
    locale,
  });

  return new URL(localizedPath, env.SITE_URL).toString();
}

/** Creates the checkout URL used when the tryout requires paid access. */
async function getCheckoutUrl({
  locale,
  returnPath,
}: {
  locale: StartTryoutInput["locale"];
  returnPath: string;
}) {
  const successUrl = getCheckoutSuccessUrl({
    locale,
    returnPath,
  });

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
  } catch (error) {
    await captureServerException(error, undefined, {
      source: "tryout-checkout-url",
      success_url: successUrl,
    });

    return null;
  }
}

/** Maps the public Convex start result into the route-level server action result. */
async function getStartTryoutResult({
  locale,
  returnPath,
  startResult,
}: {
  locale: StartTryoutInput["locale"];
  returnPath: string;
  startResult: StartTryoutMutationResult;
}): Promise<StartTryoutResult> {
  if (startResult.kind !== "requires-access") {
    return startResult;
  }

  const checkoutUrl = await getCheckoutUrl({
    locale,
    returnPath,
  });

  if (!checkoutUrl) {
    return { kind: "unknown" };
  }

  return {
    kind: "requires-access",
    url: checkoutUrl,
  };
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
  let result: StartTryoutMutationResult;

  try {
    result = await fetchAuthMutation(
      api.tryouts.mutations.attempts.startTryout,
      args
    );
  } catch (error) {
    await captureServerException(error, undefined, {
      locale: args.locale,
      product: args.product,
      source: "start-tryout",
      tryout_slug: args.tryoutSlug,
    });

    return { kind: "unknown" };
  }

  if (result.kind !== "started") {
    return await getStartTryoutResult({
      locale: args.locale,
      returnPath,
      startResult: result,
    });
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

  return result;
}
