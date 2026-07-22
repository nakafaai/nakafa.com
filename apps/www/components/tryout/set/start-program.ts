"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  StartAttemptArgs,
  TryoutPaywallSource,
} from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { toast } from "sonner";
import { reportClientException } from "@/lib/analytics/client";
import {
  isTryoutAccessRequired,
  toTryoutClientRequestError,
} from "@/lib/tryout/access";

interface StartAttemptProgramInput {
  readonly args: StartAttemptArgs;
  readonly failureMessage: string;
  readonly mutation: (args: StartAttemptArgs) => Promise<unknown>;
  readonly onSuccess: () => Effect.Effect<void>;
  readonly onUpgrade: () => Effect.Effect<void>;
}

/** Runs a start mutation and converts authoritative access denial to upgrade UI. */
export function startAttemptProgram(input: StartAttemptProgramInput) {
  return Effect.tryPromise({
    try: () => input.mutation(input.args),
    catch: toTryoutClientRequestError,
  }).pipe(
    Effect.tap(() => input.onSuccess()),
    Effect.catchAll((error) => {
      if (isTryoutAccessRequired(error)) {
        return input.onUpgrade();
      }

      return reportRequestFailure(error, "tryout-start", input.failureMessage);
    }),
    Effect.asVoid
  );
}

/** Starts one section and preserves the existing success and fallback feedback. */
export function startEntrySectionProgram(input: {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly failureMessage: string;
  readonly mutation: (args: {
    attemptId: Id<"tryoutAttempts">;
    sectionKey: string;
  }) => Promise<unknown>;
  readonly sectionKey: string;
  readonly successMessage: string;
}) {
  return Effect.tryPromise({
    try: () =>
      input.mutation({
        attemptId: input.attemptId,
        sectionKey: input.sectionKey,
      }),
    catch: toTryoutClientRequestError,
  }).pipe(
    Effect.tap(() => showSuccess(input.successMessage)),
    Effect.catchAll((error) =>
      reportRequestFailure(error, "tryout-start-section", input.failureMessage)
    ),
    Effect.asVoid
  );
}

/** Creates the existing Pro checkout and navigates to its provider URL. */
export function checkoutProgram(input: {
  readonly action: (args: {
    locale: Locale;
    successUrl: string;
  }) => Promise<{ url: string }>;
  readonly failureMessage: string;
  readonly locale: Locale;
}) {
  return Effect.tryPromise({
    try: () =>
      input.action({
        locale: input.locale,
        successUrl: window.location.href,
      }),
    catch: toTryoutClientRequestError,
  }).pipe(
    Effect.tap(({ url }) =>
      Effect.sync(() => {
        window.location.href = url;
      })
    ),
    Effect.catchAll((error) =>
      reportRequestFailure(error, "tryout-checkout", input.failureMessage)
    ),
    Effect.asVoid
  );
}

/** Records one non-blocking paywall impression and reports capture failures. */
export function paywallViewProgram(input: {
  readonly mutation: (args: {
    source: TryoutPaywallSource;
  }) => Promise<unknown>;
  readonly source: TryoutPaywallSource;
}) {
  return Effect.tryPromise({
    try: () => input.mutation({ source: input.source }),
    catch: toTryoutClientRequestError,
  }).pipe(
    Effect.catchAll((error) =>
      reportClientException(error, { source: "tryout-paywall-view" })
    ),
    Effect.asVoid
  );
}

/** Reports one unexpected request failure and shows the localized fallback. */
function reportRequestFailure(error: unknown, source: string, message: string) {
  return reportClientException(error, { source }).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        toast.error(message, { position: "bottom-center" });
      })
    )
  );
}

/** Shows one successful try-out action at the established screen position. */
function showSuccess(message: string) {
  return Effect.sync(() => {
    toast.success(message, { position: "bottom-center" });
  });
}
