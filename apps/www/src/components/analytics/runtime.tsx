"use client";

import type { BrowserAnalyticsIdentity } from "@repo/analytics/posthog/browser";
import {
  admitConsentedIdentity,
  enableBaselineAnalytics,
  revokeToBaselineAnalytics,
  suspendBrowserAnalyticsIdentity,
} from "@repo/analytics/posthog/browser";
import { untilPageRead } from "@repo/design-system/lib/settle";
import { MAIN_DOMAIN } from "@repo/site/domains";
import { Effect, Fiber, Schedule, Schema } from "effect";
import { useEffect } from "react";
import { clientEnv } from "@/env.public";
import { followConsentAnswers, startConsentMessage } from "@/lib/ads/consent";
import type { AnalyticsConsent } from "@/lib/analytics/consent";
import {
  keepConsentAnswer,
  useAnalyticsConsent,
} from "@/lib/analytics/consent";
import { clearContentViewDevice } from "@/lib/content/views/device";
import type { AccountRecord } from "@/lib/identity/viewer";

const loadGoogle = () => import("@/lib/analytics/google");

/**
 * Starts Google Analytics and Google's consent message, which consent mode
 * governs from its defaults on (`startGoogleAnalytics`), on production only, and
 * keeps each of the message's answers as the page's consent. Any other host
 * loads neither, and follows the same TCF API, which a test's stand-in message
 * answers; with none, no answer ever comes, so the page settles at once as a
 * visitor the message does not ask and counts only its cookieless baseline.
 */
const startConsent = Effect.suspend(() => {
  const follow = Effect.sync(() => followConsentAnswers(keepConsentAnswer));
  if (location.hostname === MAIN_DOMAIN) {
    return Effect.promise(loadGoogle).pipe(
      Effect.andThen(({ startGoogleAnalytics }) => startGoogleAnalytics),
      Effect.andThen(startConsentMessage),
      Effect.andThen(follow)
    );
  }
  if (window.googlefc === undefined) {
    return Effect.sync(() =>
      keepConsentAnswer({ analytics: false, asks: false })
    );
  }
  return follow;
});

/** The parts of the signed-in account that analytics reads, or none for a visitor. */
const AnalyticsAccount = Schema.Struct({
  plan: Schema.String,
  role: Schema.NullOr(Schema.String),
  userId: Schema.String,
});
type AnalyticsAccount = typeof AnalyticsAccount.Type;

/** The identity that a granted page counts under: the signed-in account, or an anonymous visitor. */
function identityOf(
  account: AnalyticsAccount | null
): BrowserAnalyticsIdentity {
  return account === null
    ? { status: "anonymous" }
    : { ...account, status: "identified" };
}

/** Moves PostHog to what the consent allows: an identity once granted, the cookieless baseline once denied. */
function transitionTo(
  analytics: AnalyticsConsent["analytics"],
  account: AnalyticsAccount | null
) {
  if (analytics === "granted") {
    return admitConsentedIdentity(identityOf(account));
  }
  if (analytics === "denied") {
    return revokeToBaselineAnalytics();
  }
  return Effect.void;
}

/**
 * The page's analytics, after the page has its reader so its first paint and
 * first JavaScript stay as they were. PostHog counts every visit in its
 * cookieless baseline, and counts the visitor's identity only once they consent
 * through Google's message. A signed-in visitor still loading counts as
 * nothing until they arrive. A device's content-view identifier goes once the
 * consent is denied.
 */
export function AnalyticsRuntime({
  account,
  isAccountPending,
}: {
  readonly account: AccountRecord | null;
  readonly isAccountPending: boolean;
}) {
  // Aksara's preview runs the page inside its editor, where nothing is counted.
  const isPreviewChild = clientEnv.VITE_AKSARA_PREVIEW_CHILD === "true";
  const analytics = useAnalyticsConsent((consent) => consent.analytics);
  const userId = account?.appUser._id ?? null;
  const plan = account?.appUser.plan ?? null;
  const role = account?.appUser.role ?? null;

  useEffect(() => {
    if (isPreviewChild) {
      return;
    }
    const consent = Effect.runFork(
      untilPageRead.pipe(Effect.andThen(startConsent))
    );
    return () => {
      Effect.runFork(Fiber.interrupt(consent));
    };
  }, [isPreviewChild]);

  useEffect(() => {
    if (isPreviewChild || isAccountPending) {
      return;
    }
    const runtime = Effect.runFork(
      untilPageRead.pipe(
        Effect.andThen(
          enableBaselineAnalytics().pipe(
            Effect.andThen(
              transitionTo(
                analytics,
                userId === null || plan === null ? null : { plan, role, userId }
              )
            ),
            Effect.retry({
              schedule: Schedule.exponential("100 millis"),
              times: 2,
            })
          )
        ),
        Effect.catchTag("BrowserAnalyticsLoadFailed", () =>
          Effect.logWarning(
            "The analytics client could not load, so the page counts nothing."
          )
        )
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(runtime));
      suspendBrowserAnalyticsIdentity();
    };
  }, [analytics, isAccountPending, isPreviewChild, plan, role, userId]);

  useEffect(() => {
    if (analytics !== "denied") {
      return;
    }
    Effect.runFork(
      clearContentViewDevice().pipe(
        // Blocked storage holds no identifier to remove.
        Effect.catchTag("ContentViewDeviceStorageFailed", () => Effect.void)
      )
    );
  }, [analytics]);

  return null;
}
