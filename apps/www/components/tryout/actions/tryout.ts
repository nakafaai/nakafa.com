"use server";

import { api } from "@repo/backend/convex/_generated/api";
import { getPathname } from "@repo/internationalization/src/navigation";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import {
  revalidateTryoutOverview,
  revalidateTryoutSet,
  type TryoutSetRouteInput,
} from "@/components/tryout/actions/revalidate";
import { env } from "@/env";
import { scheduleCurrentServerExceptionCapture } from "@/lib/analytics/server";
import { fetchAuthMutation, requireAuth } from "@/lib/auth/server";
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
  | { kind: "requires-access"; successUrl: string }
  | { kind: "not-ready" }
  | { kind: "inactive" }
  | { kind: "not-found" }
  | { kind: "unknown" };

const unknownStartTryoutResult = { kind: "unknown" } as const;

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

/** Maps the public Convex start result into the route-level server action result. */
function getStartTryoutResult({
  locale,
  returnPath,
  startResult,
}: {
  locale: StartTryoutInput["locale"];
  returnPath: string;
  startResult: StartTryoutMutationResult;
}) {
  if (startResult.kind !== "requires-access") {
    return startResult;
  }

  const successUrl = getCheckoutSuccessUrl({
    locale,
    returnPath,
  });

  if (!successUrl) {
    return unknownStartTryoutResult;
  }

  return {
    kind: "requires-access",
    successUrl,
  } as const;
}

/** Records unexpected start failures and returns the safe public fallback. */
function recoverStartTryoutError(
  error: unknown,
  args: StartTryoutArgs
): Effect.Effect<StartTryoutResult> {
  return Effect.sync(() => {
    scheduleCurrentServerExceptionCapture(error, {
      locale: args.locale,
      product: args.product,
      source: "start-tryout",
      tryout_slug: args.tryoutSlug,
    });

    return unknownStartTryoutResult;
  });
}

/**
 * Starts one tryout attempt and invalidates the SSR route family that depends
 * on the new attempt state.
 */
const startTryoutEffect = Effect.fn("www.tryout.start")(function* ({
  partKeys,
  returnPath,
  ...args
}: StartTryoutInput) {
  const result = yield* Effect.tryPromise({
    try: () =>
      fetchAuthMutation(api.tryouts.mutations.attempts.startTryout, args),
    catch: (error) => error,
  });

  if (result.kind !== "started") {
    return getStartTryoutResult({
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
});

/**
 * Authenticates the public start-tryout Server Action before mutation work.
 *
 * @see https://nextjs.org/docs/app/guides/authentication#server-actions
 * @see https://nextjs.org/docs/app/guides/data-security#mutations
 */
export async function startTryout(input: StartTryoutInput) {
  await requireAuth();

  return await Effect.runPromise(
    startTryoutEffect(input).pipe(
      Effect.catchAll((error) => recoverStartTryoutError(error, input))
    )
  );
}
