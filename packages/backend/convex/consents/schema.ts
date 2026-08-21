import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  CONSENT_CATEGORIES,
  CONSENT_NOTICE_VERSIONS,
} from "@repo/analytics/consent";
import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Consent categories that can be decided through the account API. */
export const consentCategoryValidator = literals(...CONSENT_CATEGORIES);
export type ConsentCategory = Infer<typeof consentCategoryValidator>;

/** Notice versions retained as provenance on account consent decisions. */
export const consentNoticeVersionValidator = literals(
  ...CONSENT_NOTICE_VERSIONS
);

/** The notice version accepted by the current analytics consent API. */
export const currentConsentNoticeVersionValidator = v.literal(
  ANALYTICS_CONSENT_NOTICE_VERSION
);

const consentDecisionFields = {
  category: consentCategoryValidator,
  decidedAt: v.number(),
  noticeVersion: consentNoticeVersionValidator,
};

/** Public account consent decision without storage identity fields. */
export const consentDecisionValidator = v.union(
  v.object({
    ...consentDecisionFields,
    granted: v.boolean(),
    mechanism: v.literal(ANALYTICS_CONSENT_MECHANISM),
  }),
  v.object({
    ...consentDecisionFields,
    granted: v.literal(false),
    mechanism: v.literal(ANALYTICS_BROWSER_SIGNAL_MECHANISM),
  })
);
export type ConsentDecision = Infer<typeof consentDecisionValidator>;

/** Current-version input accepted from an authenticated account. */
export const consentWriteValidator = v.union(
  v.object({
    category: consentCategoryValidator,
    granted: v.boolean(),
    mechanism: v.literal(ANALYTICS_CONSENT_MECHANISM),
    noticeVersion: currentConsentNoticeVersionValidator,
  }),
  v.object({
    category: consentCategoryValidator,
    granted: v.literal(false),
    mechanism: v.literal(ANALYTICS_BROWSER_SIGNAL_MECHANISM),
    noticeVersion: currentConsentNoticeVersionValidator,
  })
);
export type ConsentWrite = Infer<typeof consentWriteValidator>;

/** Reactive state returned for one authenticated consent category. */
export const currentConsentStateValidator = v.object({
  currentNoticeVersion: currentConsentNoticeVersionValidator,
  decision: v.union(v.null(), consentDecisionValidator),
});

const accountConsentValidator = v.union(
  v.object({
    ...consentDecisionFields,
    granted: v.boolean(),
    mechanism: v.literal(ANALYTICS_CONSENT_MECHANISM),
    userId: v.id("users"),
  }),
  v.object({
    ...consentDecisionFields,
    granted: v.literal(false),
    mechanism: v.literal(ANALYTICS_BROWSER_SIGNAL_MECHANISM),
    userId: v.id("users"),
  })
);

const tables = {
  accountConsents: defineTable(accountConsentValidator).index(
    "by_userId_and_category",
    ["userId", "category"]
  ),
  accountConsentDecisions: defineTable(accountConsentValidator).index(
    "by_userId_and_category_and_decidedAt",
    ["userId", "category", "decidedAt"]
  ),
};

export default tables;
