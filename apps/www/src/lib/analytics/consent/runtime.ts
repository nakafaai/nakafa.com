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
import { untilPageRead } from "@repo/design-system/lib/settle";
import { MAIN_DOMAIN } from "@repo/site/domains";
import { Effect, Fiber, type Option, Schedule } from "effect";
import { useEffect } from "react";
import {
  startConsentMessage,
  untilGoogleAllowsAnalytics,
} from "@/lib/ads/consent";
import {
  type AccountConsentDecision,
  type BrowserAnalyticsUser,
  createBrowserAnalyticsIdentity,
} from "@/lib/analytics/consent/state";

/**
 * Owns the baseline-to-granted runtime alignment for one consent state.
 *
 * The baseline loads once the page has its reader, so the SDK does not compete
 * with the page's first render or the reader's first press; the landing view
 * waits for a settled state so returning grants are attributed. Transient failures retry with backoff before
 * surfacing. Preview children skip the SDK; cleanup only suspends
 * authorization, never SDK consent.
 */
export function useAnalyticsRuntimeAlignment({
  accountConsent,
  anonymousConsent,
  isAuthenticated,
  isPreviewChild,
  isRuntimeSuppressed,
  setHasRuntimeError,
  status,
  user,
}: {
  readonly accountConsent: AccountConsentDecision | null;
  readonly anonymousConsent: Option.Option<AnonymousAnalyticsConsentRecord>;
  readonly isAuthenticated: boolean;
  readonly isPreviewChild: boolean;
  readonly isRuntimeSuppressed: boolean;
  readonly setHasRuntimeError: (hasRuntimeError: boolean) => void;
  readonly status: AnalyticsConsentState["status"];
  readonly user: BrowserAnalyticsUser | null;
}) {
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
      untilPageRead.pipe(
        Effect.andThen(
          enableBaselineAnalytics().pipe(
            Effect.andThen(transition),
            Effect.retry({
              schedule: Schedule.exponential("100 millis"),
              times: 2,
            })
          )
        ),
        Effect.andThen(Effect.sync(() => setHasRuntimeError(false))),
        Effect.catchTag("BrowserAnalyticsLoadFailed", () =>
          Effect.sync(() => setHasRuntimeError(true))
        )
      )
    );

    // Google's consent message and Google Analytics run on production only, after
    // the page has its reader: the message on every page, and Google Analytics once
    // Nakafa's consent and Google's both allow it. A denial stops it.
    const googleFiber =
      location.hostname === MAIN_DOMAIN
        ? Effect.runFork(
            untilPageRead.pipe(
              Effect.andThen(
                Effect.promise(() => import("@/lib/analytics/google"))
              ),
              Effect.andThen(({ startGoogleAnalytics, stopGoogleAnalytics }) =>
                Effect.all(
                  [
                    startConsentMessage,
                    analyticsIdentity
                      ? untilGoogleAllowsAnalytics.pipe(
                          Effect.andThen(startGoogleAnalytics)
                        )
                      : stopGoogleAnalytics,
                  ],
                  { concurrency: "unbounded", discard: true }
                )
              )
            )
          )
        : null;

    return () => {
      Effect.runFork(Fiber.interrupt(runtimeFiber));
      if (googleFiber) {
        Effect.runFork(Fiber.interrupt(googleFiber));
      }
      suspendBrowserAnalyticsIdentity();
    };
  }, [
    accountConsent,
    anonymousConsent,
    isAuthenticated,
    isPreviewChild,
    isRuntimeSuppressed,
    setHasRuntimeError,
    status,
    user,
  ]);
}
