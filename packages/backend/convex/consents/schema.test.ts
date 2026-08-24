import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import { consentWriteValidator } from "@repo/backend/convex/consents/schema";
import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";

describe("consent schema", () => {
  it("rejects stale notice versions", () => {
    expect(
      validate(consentWriteValidator, {
        category: ANALYTICS_CONSENT_CATEGORY,
        granted: true,
        mechanism: ANALYTICS_CONSENT_MECHANISM,
        noticeVersion: "privacy-stale",
      })
    ).toBe(false);
  });

  it("accepts only a denial from a browser privacy signal", () => {
    expect(
      validate(consentWriteValidator, {
        category: ANALYTICS_CONSENT_CATEGORY,
        granted: false,
        mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      })
    ).toBe(true);
    expect(
      validate(consentWriteValidator, {
        category: ANALYTICS_CONSENT_CATEGORY,
        granted: true,
        mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      })
    ).toBe(false);
  });
});
