import type { Ref } from "@confect/core";
import {
  ANALYTICS_CONSENT_DENIED,
  ANALYTICS_CONSENT_GRANTED,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  type AnalyticsConsentAccountMarker,
  type AnalyticsConsentState,
  type AnonymousAnalyticsConsentRecord,
  AnonymousAnalyticsConsentRecordSchema,
  resolveAnalyticsConsentState,
} from "@repo/analytics/consent";
import type { BrowserAnalyticsIdentity } from "@repo/analytics/posthog/browser";
import type consents from "@repo/backend/confect/_generated/refs/consents";

import { Option, Schema } from "effect";

const BrowserAnalyticsUserSchema = Schema.Struct({
  appUser: Schema.Struct({
    _id: Schema.String,
    plan: Schema.String,
    role: Schema.optionalKey(Schema.String),
  }),
});

export type BrowserAnalyticsUser = typeof BrowserAnalyticsUserSchema.Type;

const BrowserConsentSnapshotSchema = Schema.Struct({
  anonymousConsent: Schema.Option(AnonymousAnalyticsConsentRecordSchema),
  hasBrowserPrivacySignal: Schema.Boolean,
  isResolved: Schema.Boolean,
});

export type BrowserConsentSnapshot = typeof BrowserConsentSnapshotSchema.Type;

export type AccountConsentDecision = NonNullable<
  Ref.Returns<typeof consents.current.get>["decision"]
>;

/** Returns whether a browser privacy signal must revoke an account grant. */
export function shouldRevokeAccountAnalyticsGrant({
  accountConsent,
  browserConsent,
  isAccountConsentResolved,
  isAuthenticated,
}: {
  readonly accountConsent: AccountConsentDecision | null;
  readonly browserConsent: BrowserConsentSnapshot;
  readonly isAccountConsentResolved: boolean;
  readonly isAuthenticated: boolean;
}) {
  return (
    isAuthenticated &&
    isAccountConsentResolved &&
    browserConsent.hasBrowserPrivacySignal &&
    accountConsent?.granted === true
  );
}

/** Returns whether this browser must retain a current anonymous denial. */
export function shouldPersistAnonymousAnalyticsDenial({
  accountConsent,
  browserConsent,
  isAuthenticated,
}: {
  readonly accountConsent: AccountConsentDecision | null;
  readonly browserConsent: BrowserConsentSnapshot;
  readonly isAuthenticated: boolean;
}) {
  if (!browserConsent.isResolved) {
    return false;
  }

  const mustDeny =
    browserConsent.hasBrowserPrivacySignal ||
    (isAuthenticated && accountConsent?.granted === false);
  if (!mustDeny) {
    return false;
  }

  return Option.match(browserConsent.anonymousConsent, {
    onNone: () => true,
    onSome: (consent) =>
      consent.decision !== ANALYTICS_CONSENT_DENIED ||
      consent.noticeVersion !== ANALYTICS_CONSENT_NOTICE_VERSION,
  });
}

/**
 * The marker this browser keeps of the signed-in account's confirmed choice, with
 * the session it belongs to. Only a choice that Convex confirmed for a settled
 * signed-in session is recorded, so a marker never names a session it did not see.
 */
export function createAccountConsentMarker({
  accountConsent,
  isAuthenticated,
  sessionId,
}: {
  readonly accountConsent: AccountConsentDecision | null;
  readonly isAuthenticated: boolean;
  readonly sessionId: string | null;
}): AnalyticsConsentAccountMarker | null {
  if (!isAuthenticated || sessionId === null || accountConsent === null) {
    return null;
  }

  return {
    granted: accountConsent.granted,
    noticeVersion: accountConsent.noticeVersion,
    sessionId,
  };
}

/** Resolves preview, auth, account, and anonymous consent into one state. */
export function resolveBrowserAnalyticsConsentState({
  accountConsent,
  browserConsent,
  isAccountConsentResolved,
  isAuthenticated,
  isAuthLoading,
  isPreviewChild,
  isUserPending,
  user,
}: {
  readonly accountConsent: AccountConsentDecision | null;
  readonly browserConsent: BrowserConsentSnapshot;
  readonly isAccountConsentResolved: boolean;
  readonly isAuthenticated: boolean;
  readonly isAuthLoading: boolean;
  readonly isPreviewChild: boolean;
  readonly isUserPending: boolean;
  readonly user: BrowserAnalyticsUser | null;
}): AnalyticsConsentState {
  if (isPreviewChild) {
    return { status: "browser-signal" };
  }

  return resolveAnalyticsConsentState({
    accountConsent,
    anonymousConsent: browserConsent.anonymousConsent,
    hasBrowserPrivacySignal: browserConsent.hasBrowserPrivacySignal,
    isAccountConsentResolved,
    isAuthenticated,
    isAuthLoading:
      isAuthLoading ||
      isUserPending ||
      (isAuthenticated && !user) ||
      !(isAuthenticated || browserConsent.isResolved),
  });
}

/** Projects a proven grant into the only identity the SDK may authorize. */
export function createBrowserAnalyticsIdentity({
  accountConsent,
  anonymousConsent,
  isAuthenticated,
  status,
  user,
}: {
  readonly accountConsent: AccountConsentDecision | null;
  readonly anonymousConsent: Option.Option<AnonymousAnalyticsConsentRecord>;
  readonly isAuthenticated: boolean;
  readonly status: AnalyticsConsentState["status"];
  readonly user: BrowserAnalyticsUser | null;
}): BrowserAnalyticsIdentity | null {
  if (status !== "granted") {
    return null;
  }

  if (!isAuthenticated) {
    return Option.match(anonymousConsent, {
      onNone: () => null,
      onSome: (consent): BrowserAnalyticsIdentity | null => {
        if (
          consent.decision !== ANALYTICS_CONSENT_GRANTED ||
          consent.noticeVersion !== ANALYTICS_CONSENT_NOTICE_VERSION
        ) {
          return null;
        }

        return {
          consentDecidedAt: consent.decidedAt,
          consentMechanism: consent.mechanism,
          consentNoticeVersion: consent.noticeVersion,
          status: "anonymous",
        };
      },
    });
  }

  if (
    !(
      user &&
      accountConsent?.granted &&
      accountConsent.noticeVersion === ANALYTICS_CONSENT_NOTICE_VERSION
    )
  ) {
    return null;
  }

  return {
    consentDecidedAt: accountConsent.decidedAt,
    consentMechanism: accountConsent.mechanism,
    consentNoticeVersion: accountConsent.noticeVersion,
    plan: user.appUser.plan,
    role: user.appUser.role ?? null,
    status: "identified",
    userId: user.appUser._id,
  };
}
