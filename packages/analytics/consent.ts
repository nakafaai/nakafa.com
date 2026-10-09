import { Array as Arr, Option, Schema } from "effect";

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

export type AnalyticsConsentDecision =
  typeof AnalyticsConsentDecisionSchema.Type;

/** Epoch milliseconds of one recorded anonymous consent decision. */
export const AnonymousAnalyticsConsentDecidedAtSchema = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0)
);

const anonymousConsentFields = {
  category: Schema.Literals(CONSENT_CATEGORIES),
  decidedAt: AnonymousAnalyticsConsentDecidedAtSchema,
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

export type AnonymousAnalyticsConsentRecord =
  typeof AnonymousAnalyticsConsentRecordSchema.Type;

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

const AnalyticsConsentScopeSchema = Schema.Literals(["account", "anonymous"]);
/** Identity scope that one analytics consent decision belongs to. */
export type AnalyticsConsentScope = typeof AnalyticsConsentScopeSchema.Type;

export const AnalyticsConsentStateSchema = Schema.Union([
  Schema.Struct({
    scope: AnalyticsConsentScopeSchema,
    status: Schema.Literal("denied"),
  }),
  Schema.Struct({ status: Schema.Literal("browser-signal") }),
  Schema.Struct({
    scope: AnalyticsConsentScopeSchema,
    status: Schema.Literal("granted"),
  }),
  Schema.Struct({ status: Schema.Literal("pending") }),
  Schema.Struct({
    scope: AnalyticsConsentScopeSchema,
    status: Schema.Literal("prompt"),
  }),
]);

export type AnalyticsConsentState = typeof AnalyticsConsentStateSchema.Type;

const AccountAnalyticsConsentSchema = Schema.Struct({
  granted: Schema.Boolean,
  noticeVersion: Schema.String,
});

type AccountAnalyticsConsent = typeof AccountAnalyticsConsentSchema.Type;

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

  return Arr.some(doNotTrack, (signal) => signal === "1" || signal === "yes");
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
