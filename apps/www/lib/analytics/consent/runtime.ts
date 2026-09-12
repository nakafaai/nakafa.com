"use client";

import type {
  AnalyticsConsentState,
  AnonymousAnalyticsConsentRecord,
} from "@repo/analytics/consent";
import {
  admitConsentedIdentity,
  type BrowserAnalyticsLoadFailed,
  enableBaselineAnalytics,
  revokeToBaselineAnalytics,
  suspendBrowserAnalyticsIdentity,
} from "@repo/analytics/posthog/browser";
import { Effect, Fiber, type Option, Schedule } from "effect";
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
 * The baseline warms up on load; the landing view waits for a settled state
 * so returning grants are attributed. Transient failures retry with backoff
 * before surfacing. Preview children skip the SDK; cleanup only suspends
 * authorization, never SDK consent.
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
    // Pending proves no identity yet: warm up only, or a returning grant
    // would lock in as an anonymous baseline.
    let transition: Effect.Effect<void, BrowserAnalyticsLoadFailed>;
    if (analyticsIdentity) {
      transition = admitConsentedIdentity(analyticsIdentity);
    } else if (status === "pending") {
      transition = Effect.void;
    } else {
      transition = revokeToBaselineAnalytics();
    }
    const runtimeFiber = Effect.runFork(
      enableBaselineAnalytics().pipe(
        Effect.andThen(transition),
        Effect.retry({
          schedule: Schedule.exponential("100 millis"),
          times: 2,
        }),
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
