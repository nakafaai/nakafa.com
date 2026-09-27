import { describe, expect, it } from "@effect/vitest";
import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import { consentWriteValidator } from "@repo/backend/confect/consents/schema";
import { Option, Schema } from "effect";

describe("consent schema", () => {
  it("rejects stale notice versions", () => {
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(consentWriteValidator)(
          {
            category: ANALYTICS_CONSENT_CATEGORY,
            granted: true,
            mechanism: ANALYTICS_CONSENT_MECHANISM,
            noticeVersion: "privacy-stale",
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(false);
  });
  it("accepts only a denial from a browser privacy signal", () => {
    expect(
      Option.isSome(
        Schema.decodeOption(consentWriteValidator)(
          {
            category: ANALYTICS_CONSENT_CATEGORY,
            granted: false,
            mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
            noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(consentWriteValidator)(
          {
            category: ANALYTICS_CONSENT_CATEGORY,
            granted: true,
            mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
            noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(false);
  });
});
