import {
  ANALYTICS_CONSENT_NOTICE_VERSION,
  type AnalyticsConsentState,
  type AnonymousAnalyticsConsentRecord,
  resolveAnalyticsConsentState,
} from "@repo/analytics/consent";
import type { BrowserAnalyticsIdentity } from "@repo/analytics/posthog/browser";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Option } from "effect";

export interface BrowserAnalyticsUser {
  readonly appUser: {
    readonly _id: string;
    readonly plan: string;
    readonly role?: string;
  };
}

export interface BrowserConsentSnapshot {
  readonly anonymousConsent: Option.Option<AnonymousAnalyticsConsentRecord>;
  readonly hasBrowserPrivacySignal: boolean;
  readonly isResolved: boolean;
}

export type AccountConsentDecision = NonNullable<
  FunctionReturnType<typeof api.consents.queries.getCurrent>["decision"]
>;

export type AnalyticsConsentPromptIdentity =
  | `account:${string}:${typeof ANALYTICS_CONSENT_NOTICE_VERSION}`
  | `anonymous:${typeof ANALYTICS_CONSENT_NOTICE_VERSION}`;

export interface AnalyticsConsentSessionOverride {
  readonly granted: boolean;
  readonly persistence: "failed" | "pending";
}

export type AnalyticsConsentSessionOverrides = ReadonlyMap<
  AnalyticsConsentPromptIdentity,
  AnalyticsConsentSessionOverride
>;

/** Identifies the current account or anonymous scope and consent notice. */
export function createAnalyticsConsentPromptIdentity({
  isAuthenticated,
  user,
}: {
  readonly isAuthenticated: boolean;
  readonly user: BrowserAnalyticsUser | null;
}): AnalyticsConsentPromptIdentity | null {
  if (!isAuthenticated) {
    return `anonymous:${ANALYTICS_CONSENT_NOTICE_VERSION}`;
  }

  if (!user) {
    return null;
  }

  return `account:${user.appUser._id}:${ANALYTICS_CONSENT_NOTICE_VERSION}`;
}

/** Records one visitor-scoped choice without mutating prior session state. */
export function setAnalyticsConsentSessionOverride({
  override,
  overrides,
  promptIdentity,
}: {
  readonly override: AnalyticsConsentSessionOverride;
  readonly overrides: AnalyticsConsentSessionOverrides;
  readonly promptIdentity: AnalyticsConsentPromptIdentity;
}): AnalyticsConsentSessionOverrides {
  const nextOverrides = new Map(overrides);
  nextOverrides.set(promptIdentity, override);
  return nextOverrides;
}

/** Clears transient state after its durable source has synchronized. */
export function clearAnalyticsConsentSessionOverride({
  overrides,
  promptIdentity,
}: {
  readonly overrides: AnalyticsConsentSessionOverrides;
  readonly promptIdentity: AnalyticsConsentPromptIdentity;
}): AnalyticsConsentSessionOverrides {
  const nextOverrides = new Map(overrides);
  nextOverrides.delete(promptIdentity);
  return nextOverrides;
}

/** Projects transient prompt, runtime, and persistence policy for one visitor. */
export function resolveAnalyticsConsentSessionPolicy({
  hasLoadError,
  overrides,
  promptIdentity,
  status,
}: {
  readonly hasLoadError: boolean;
  readonly overrides: AnalyticsConsentSessionOverrides;
  readonly promptIdentity: AnalyticsConsentPromptIdentity | null;
  readonly status: AnalyticsConsentState["status"];
}) {
  const override = promptIdentity ? overrides.get(promptIdentity) : undefined;
  const hasHandledPrompt = override !== undefined;

  return {
    hasSaveError: override?.persistence === "failed",
    isPromptOpen:
      !!promptIdentity &&
      !hasHandledPrompt &&
      (status === "prompt" || (hasLoadError && status === "pending")),
    isRuntimeSuppressed:
      !!override && (!override.granted || override.persistence === "failed"),
    isSaving: override?.persistence === "pending",
  };
}

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
      consent.decision !== "denied" ||
      consent.noticeVersion !== ANALYTICS_CONSENT_NOTICE_VERSION,
  });
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
          consent.decision !== "granted" ||
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
