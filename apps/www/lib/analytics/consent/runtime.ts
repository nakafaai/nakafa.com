"use client";

import type {
  AnalyticsConsentState,
  AnonymousAnalyticsConsentRecord,
} from "@repo/analytics/consent";
import {
  admitConsentedIdentity,
  enableBaselineAnalytics,
  revokeToBaselineAnalytics,
  suspendBrowserAnalyticsIdentity,
} from "@repo/analytics/posthog/browser";
import { Effect, Fiber, type Option } from "effect";
import { useEffect, useState } from "react";
import {
  type AccountConsentDecision,
  type BrowserAnalyticsUser,
  createBrowserAnalyticsIdentity,
} from "@/lib/analytics/consent/state";

interface AnalyticsRuntimeAlignmentOptions {
  readonly accountConsent: AccountConsentDecision | null;
  readonly anonymousConsent: Option.Option<AnonymousAnalyticsConsentRecord>;
  readonly isAuthenticated: boolean;
  readonly isPreviewChild: boolean;
  readonly isRuntimeSuppressed: boolean;
  readonly status: AnalyticsConsentState["status"];
  readonly user: BrowserAnalyticsUser | null;
}

/**
 * Owns the baseline-to-granted runtime alignment for one consent state.
 *
 * The baseline client counts every visit cookielessly; a proven grant is
 * admitted in one transition. Preview children never load the SDK because
 * their proxy rewrites do not exist. Cleanup only suspends authorization so
 * SDK consent is never touched by lifecycle.
 */
export function useAnalyticsRuntimeAlignment({
  accountConsent,
  anonymousConsent,
  isAuthenticated,
  isPreviewChild,
  isRuntimeSuppressed,
  status,
  user,
}: AnalyticsRuntimeAlignmentOptions) {
  const [hasRuntimeError, setRuntimeError] = useState(false);

  useEffect(() => {
    if (isPreviewChild) {
      return;
    }

    const analyticsIdentity = isRuntimeSuppressed
      ? null
      : createBrowserAnalyticsIdentity({
          accountConsent,
          anonymousConsent,
          isAuthenticated,
          status,
          user,
        });
    const runtimeFiber = Effect.runFork(
      enableBaselineAnalytics().pipe(
        Effect.andThen(
          analyticsIdentity
            ? admitConsentedIdentity(analyticsIdentity)
            : revokeToBaselineAnalytics()
        ),
        Effect.andThen(Effect.sync(() => setRuntimeError(false))),
        Effect.catchTag("BrowserAnalyticsLoadFailed", () =>
          Effect.sync(() => setRuntimeError(true))
        )
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(runtimeFiber));
      suspendBrowserAnalyticsIdentity();
    };
  }, [
    accountConsent,
    anonymousConsent,
    isAuthenticated,
    isPreviewChild,
    isRuntimeSuppressed,
    status,
    user,
  ]);

  return hasRuntimeError;
}
