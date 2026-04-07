"use server";

import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import { getPathname } from "@repo/internationalization/src/navigation";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { Effect } from "effect";
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

/** Builds a trusted absolute checkout return URL from one localized app path. */
function getCheckoutSuccessUrl({
  locale,
  returnPath,
}: {
  locale: StartTryoutInput["locale"];
  returnPath: string;
}) {
  if (!returnPath.startsWith("/") || returnPath.startsWith("//")) {
    return null;
  }

  const localizedPath = getPathname({
    href: returnPath,
    locale,
  });

  return new URL(localizedPath, env.SITE_URL).toString();
}

/** Creates the checkout URL used when the tryout requires paid access. */
function getCheckoutUrl({
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
    return Promise.resolve(null);
  }

  return Effect.runPromise(
    Effect.tryPromise({
      try: () =>
        fetchAuthAction(api.customers.actions.public.generateCheckoutLink, {
          productIds: [products.pro.id],
          successUrl,
        }),
      catch: () => null,
    }).pipe(
      Effect.map((result) => result?.url ?? null),
      Effect.catchAll(() => Effect.succeed(null))
    )
  );
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
  const result = await Effect.runPromise(
    Effect.tryPromise({
      try: () =>
        fetchAuthMutation(api.tryouts.mutations.attempts.startTryout, args),
      catch: (error) => error,
    }).pipe(
      Effect.map(() => true),
      Effect.catchAll((error) => Effect.succeed(getStartTryoutErrorCode(error)))
    )
  );

  if (result === true) {
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

  if (result === "COMPETITION_ATTEMPT_ALREADY_USED") {
    return {
      code: "COMPETITION_ATTEMPT_ALREADY_USED",
      ok: false,
    };
  }

  if (result === "TRYOUT_ACCESS_REQUIRED") {
    const checkoutUrl = await getCheckoutUrl({
      locale: args.locale,
      returnPath,
    });

    if (checkoutUrl) {
      return {
        code: "TRYOUT_ACCESS_REQUIRED",
        ok: false,
        url: checkoutUrl,
      };
    }
  }

  return {
    code: "UNKNOWN",
    ok: false,
  };
}
