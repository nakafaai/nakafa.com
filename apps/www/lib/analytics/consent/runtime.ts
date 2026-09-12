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
 * The baseline client loads on every visit so the SDK warms up, but the
 * landing view waits for a settled (non-pending) state: a returning grant is
 * then attributed instead of counted as an anonymous baseline. Transient SDK
 * failures retry twice with backoff before surfacing; the error clears on the
 * next successful alignment. Preview children never load the SDK because
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
    // Pending states carry no proven identity yet: warm up the baseline
    // client but hold the landing view until the first settled admission
    // attributes it. Admitting now would lock in an anonymous baseline for
    // returning granted visitors.
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
