import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  CONSENT_CATEGORIES,
  CONSENT_NOTICE_VERSIONS,
} from "@repo/analytics/consent";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
/** Consent categories that can be decided through the account API. */
export const consentCategoryValidator = Schema.Literals([
  ...CONSENT_CATEGORIES,
]);
export type ConsentCategory = typeof consentCategoryValidator.Type;

/** Notice versions retained as provenance on account consent decisions. */
export const consentNoticeVersionValidator = Schema.Literals([
  ...CONSENT_NOTICE_VERSIONS,
]);

/** The notice version accepted by the current analytics consent API. */
export const currentConsentNoticeVersionValidator = Schema.Literal(
  ANALYTICS_CONSENT_NOTICE_VERSION
);
const consentDecisionFields = {
  category: consentCategoryValidator,
  decidedAt: Schema.Finite,
  noticeVersion: consentNoticeVersionValidator,
};

/** Public account consent decision without storage identity fields. */
export const consentDecisionValidator = Schema.Union([
  Schema.Struct({
    ...consentDecisionFields,
    granted: Schema.Boolean,
    mechanism: Schema.Literal(ANALYTICS_CONSENT_MECHANISM),
  }),
  Schema.Struct({
    ...consentDecisionFields,
    granted: Schema.Literal(false),
    mechanism: Schema.Literal(ANALYTICS_BROWSER_SIGNAL_MECHANISM),
  }),
]);
export type ConsentDecision = typeof consentDecisionValidator.Type;

/** Current-version input accepted from an authenticated account. */
export const consentWriteValidator = Schema.Union([
  Schema.Struct({
    category: consentCategoryValidator,
    granted: Schema.Boolean,
    mechanism: Schema.Literal(ANALYTICS_CONSENT_MECHANISM),
    noticeVersion: currentConsentNoticeVersionValidator,
  }),
  Schema.Struct({
    category: consentCategoryValidator,
    granted: Schema.Literal(false),
    mechanism: Schema.Literal(ANALYTICS_BROWSER_SIGNAL_MECHANISM),
    noticeVersion: currentConsentNoticeVersionValidator,
  }),
]);
export type ConsentWrite = typeof consentWriteValidator.Type;

/** Reactive state returned for one authenticated consent category. */
export const currentConsentStateValidator = Schema.Struct({
  currentNoticeVersion: currentConsentNoticeVersionValidator,
  decision: Schema.Union([Schema.Null, consentDecisionValidator]),
});
export const accountConsentValidator = Schema.Union([
  Schema.Struct({
    ...consentDecisionFields,
    granted: Schema.Boolean,
    mechanism: Schema.Literal(ANALYTICS_CONSENT_MECHANISM),
    userId: IdSchema("users"),
  }),
  Schema.Struct({
    ...consentDecisionFields,
    granted: Schema.Literal(false),
    mechanism: Schema.Literal(ANALYTICS_BROWSER_SIGNAL_MECHANISM),
    userId: IdSchema("users"),
  }),
]);
export const consentPersistenceFailedCode = "CONSENT_PERSISTENCE_FAILED";
export const consentPersistenceFailedMessage =
  "Unable to read or persist account consent.";
/** Raised when account consent state cannot be read or persisted safely. */
export class ConsentPersistenceError extends Schema.TaggedError<ConsentPersistenceError>()(
  "ConsentPersistenceError",
  {
    code: Schema.Literal(consentPersistenceFailedCode),
    message: Schema.Literal(consentPersistenceFailedMessage),
  }
) {}

/** Maps a Convex database failure into the consent domain error channel. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
