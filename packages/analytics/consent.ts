import { Option, Schema } from "effect";

/** Consent categories currently presented by Nakafa's privacy controls. */
export const CONSENT_CATEGORIES = ["analytics"] satisfies readonly [
  "analytics",
];

/** Stable category token shared by browser and backend analytics gates. */
export const ANALYTICS_CONSENT_CATEGORY = CONSENT_CATEGORIES[0];

/** Supported UI mechanisms retained with consent audit evidence. */
export const CONSENT_DECISION_MECHANISMS = [
  "privacy-controls",
  "browser-privacy-signal",
] satisfies readonly ["privacy-controls", "browser-privacy-signal"];

/** Mechanism used by the current first-party analytics preference surface. */
export const ANALYTICS_CONSENT_MECHANISM = CONSENT_DECISION_MECHANISMS[0];

/** Mechanism recorded when DNT or GPC revokes an existing account grant. */
export const ANALYTICS_BROWSER_SIGNAL_MECHANISM =
  CONSENT_DECISION_MECHANISMS[1];

/** Notice versions retained with legally relevant consent decisions. */
export const CONSENT_NOTICE_VERSIONS = [
  "privacy-2026-08-22",
  "privacy-2026-08-21",
] satisfies readonly ["privacy-2026-08-22", "privacy-2026-08-21"];

/** Privacy notice that currently governs optional product analytics. */
export const ANALYTICS_CONSENT_NOTICE_VERSION = CONSENT_NOTICE_VERSIONS[0];

/** Browser storage key for a visitor's anonymous analytics decision. */
export const ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY =
  "nakafa-analytics-consent";

export const AnalyticsConsentDecisionSchema = Schema.Literals([
  "granted",
  "denied",
]);

export type AnalyticsConsentDecision = Schema.Schema.Type<
  typeof AnalyticsConsentDecisionSchema
>;

const anonymousConsentFields = {
  category: Schema.Literals(CONSENT_CATEGORIES),
  decidedAt: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  noticeVersion: Schema.Literals(CONSENT_NOTICE_VERSIONS),
};

export const AnonymousAnalyticsConsentRecordSchema = Schema.Union([
  Schema.Struct({
    ...anonymousConsentFields,
    decision: AnalyticsConsentDecisionSchema,
    mechanism: Schema.Literal(ANALYTICS_CONSENT_MECHANISM),
  }),
  Schema.Struct({
    ...anonymousConsentFields,
    decision: Schema.Literal("denied"),
    mechanism: Schema.Literal(ANALYTICS_BROWSER_SIGNAL_MECHANISM),
  }),
]);

export type AnonymousAnalyticsConsentRecord = Schema.Schema.Type<
  typeof AnonymousAnalyticsConsentRecordSchema
>;

const AnonymousAnalyticsConsentSchema = Schema.fromJsonString(
  AnonymousAnalyticsConsentRecordSchema
);

export const decodeAnonymousAnalyticsConsent = Schema.decodeUnknownOption(
  AnonymousAnalyticsConsentSchema
);

export const encodeAnonymousAnalyticsConsent = Schema.encodeEffect(
  AnonymousAnalyticsConsentSchema
);

/** Creates the exact anonymous record persisted after a browser decision. */
export function createAnonymousAnalyticsConsent(
  decision: AnalyticsConsentDecision,
  decidedAt: number
): AnonymousAnalyticsConsentRecord {
  return {
    category: "analytics",
    decidedAt,
    decision,
    mechanism: ANALYTICS_CONSENT_MECHANISM,
    noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
  };
}

/** Records that a browser-wide privacy signal denied anonymous analytics. */
export function createAnonymousAnalyticsBrowserSignalDenial(
  decidedAt: number
): AnonymousAnalyticsConsentRecord {
  return {
    category: "analytics",
    decidedAt,
    decision: "denied",
    mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
    noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
  };
}

export type AnalyticsConsentState =
  | { readonly status: "denied"; readonly scope: "account" | "anonymous" }
  | { readonly status: "browser-signal" }
  | { readonly status: "granted"; readonly scope: "account" | "anonymous" }
  | { readonly status: "pending" }
  | { readonly status: "prompt"; readonly scope: "account" | "anonymous" };

interface AccountAnalyticsConsent {
  readonly granted: boolean;
  readonly noticeVersion: string;
}

/** Honors explicit browser-wide DNT and Global Privacy Control preferences. */
export function hasBrowserPrivacySignal({
  doNotTrack,
  globalPrivacyControl,
}: {
  readonly doNotTrack: ReadonlyArray<string | null | undefined>;
  readonly globalPrivacyControl: unknown;
}) {
  if (globalPrivacyControl === true) {
    return true;
  }

  return doNotTrack.some((signal) => signal === "1" || signal === "yes");
}

/** Resolves the only analytics state the browser may enforce right now. */
export function resolveAnalyticsConsentState({
  accountConsent,
  anonymousConsent,
  hasBrowserPrivacySignal,
  isAccountConsentResolved,
  isAuthenticated,
  isAuthLoading,
}: {
  readonly accountConsent: AccountAnalyticsConsent | null;
  readonly anonymousConsent: Option.Option<AnonymousAnalyticsConsentRecord>;
  readonly hasBrowserPrivacySignal: boolean;
  readonly isAccountConsentResolved: boolean;
  readonly isAuthenticated: boolean;
  readonly isAuthLoading: boolean;
}): AnalyticsConsentState {
  if (hasBrowserPrivacySignal) {
    return { status: "browser-signal" };
  }

  if (isAuthLoading) {
    return { status: "pending" };
  }

  if (isAuthenticated) {
    if (!isAccountConsentResolved) {
      return { status: "pending" };
    }

    if (!accountConsent) {
      return { scope: "account", status: "prompt" };
    }

    if (!accountConsent.granted) {
      return { scope: "account", status: "denied" };
    }

    if (accountConsent.noticeVersion !== ANALYTICS_CONSENT_NOTICE_VERSION) {
      return { scope: "account", status: "prompt" };
    }

    return { scope: "account", status: "granted" };
  }

  return Option.match(anonymousConsent, {
    onNone: () => ({ scope: "anonymous", status: "prompt" }),
    onSome: (record) => {
      if (record.decision === "denied") {
        return { scope: "anonymous", status: "denied" };
      }

      if (record.noticeVersion !== ANALYTICS_CONSENT_NOTICE_VERSION) {
        return { scope: "anonymous", status: "prompt" };
      }

      return { scope: "anonymous", status: "granted" };
    },
  });
}
