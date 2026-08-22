import {
  ANALYTICS_CONSENT_NOTICE_VERSION,
  AnonymousAnalyticsConsentRecordSchema,
  CONSENT_NOTICE_VERSIONS,
  createAnonymousAnalyticsBrowserSignalDenial,
  createAnonymousAnalyticsConsent,
  decodeAnonymousAnalyticsConsent,
  encodeAnonymousAnalyticsConsent,
  hasBrowserPrivacySignal,
  resolveAnalyticsConsentState,
} from "@repo/analytics/consent";
import { Effect, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

const grantedAnonymousConsent = Schema.decodeSync(
  AnonymousAnalyticsConsentRecordSchema
)({
  category: "analytics",
  decidedAt: 1_776_556_800_000,
  decision: "granted",
  mechanism: "privacy-controls",
  noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
});

const retainedAnonymousGrant = Schema.decodeSync(
  AnonymousAnalyticsConsentRecordSchema
)({
  ...grantedAnonymousConsent,
  noticeVersion: CONSENT_NOTICE_VERSIONS[1],
});

const retainedAnonymousDenial = Schema.decodeSync(
  AnonymousAnalyticsConsentRecordSchema
)({
  ...retainedAnonymousGrant,
  decision: "denied",
});

describe("analytics consent contract", () => {
  it("round-trips the current anonymous consent record", async () => {
    const encoded = await Effect.runPromise(
      encodeAnonymousAnalyticsConsent(grantedAnonymousConsent)
    );

    expect(
      Option.getOrUndefined(decodeAnonymousAnalyticsConsent(encoded))
    ).toEqual(grantedAnonymousConsent);
  });

  it("creates a record governed by the current notice", () => {
    expect(createAnonymousAnalyticsConsent("denied", 100)).toEqual({
      category: "analytics",
      decidedAt: 100,
      decision: "denied",
      mechanism: "privacy-controls",
      noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
    });
    expect(createAnonymousAnalyticsBrowserSignalDenial(200)).toEqual({
      category: "analytics",
      decidedAt: 200,
      decision: "denied",
      mechanism: "browser-privacy-signal",
      noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
    });
  });

  it("rejects malformed or stale anonymous state", () => {
    const staleConsent = decodeAnonymousAnalyticsConsent(
      JSON.stringify({
        ...grantedAnonymousConsent,
        noticeVersion: "privacy-2025-01-01",
      })
    );

    expect(Option.isNone(decodeAnonymousAnalyticsConsent("not-json"))).toBe(
      true
    );
    expect(Option.isNone(staleConsent)).toBe(true);
    expect(
      Option.isNone(
        decodeAnonymousAnalyticsConsent(
          JSON.stringify({
            ...grantedAnonymousConsent,
            mechanism: "browser-privacy-signal",
          })
        )
      )
    ).toBe(true);
    expect(
      Option.getOrUndefined(
        decodeAnonymousAnalyticsConsent(
          JSON.stringify(createAnonymousAnalyticsBrowserSignalDenial(200))
        )
      )
    ).toEqual(createAnonymousAnalyticsBrowserSignalDenial(200));
  });

  it("recognizes supported browser privacy signals only", () => {
    expect(
      hasBrowserPrivacySignal({
        doNotTrack: [undefined, null, "0"],
        globalPrivacyControl: false,
      })
    ).toBe(false);
    expect(
      hasBrowserPrivacySignal({
        doNotTrack: ["1"],
        globalPrivacyControl: undefined,
      })
    ).toBe(true);
    expect(
      hasBrowserPrivacySignal({
        doNotTrack: ["yes"],
        globalPrivacyControl: false,
      })
    ).toBe(true);
    expect(
      hasBrowserPrivacySignal({
        doNotTrack: ["0"],
        globalPrivacyControl: true,
      })
    ).toBe(true);
  });

  it("blocks analytics while a browser privacy signal is active", () => {
    expect(
      resolveAnalyticsConsentState({
        accountConsent: {
          granted: true,
          noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
        },
        anonymousConsent: Option.some(grantedAnonymousConsent),
        hasBrowserPrivacySignal: true,
        isAccountConsentResolved: true,
        isAuthenticated: true,
        isAuthLoading: false,
      })
    ).toEqual({ status: "browser-signal" });
  });

  it("waits for authentication and the account decision query", () => {
    expect(
      resolveAnalyticsConsentState({
        accountConsent: null,
        anonymousConsent: Option.none(),
        hasBrowserPrivacySignal: false,
        isAccountConsentResolved: false,
        isAuthenticated: false,
        isAuthLoading: true,
      })
    ).toEqual({ status: "pending" });
    expect(
      resolveAnalyticsConsentState({
        accountConsent: null,
        anonymousConsent: Option.none(),
        hasBrowserPrivacySignal: false,
        isAccountConsentResolved: false,
        isAuthenticated: true,
        isAuthLoading: false,
      })
    ).toEqual({ status: "pending" });
  });

  it("never lets an anonymous decision authorize a signed-in account", () => {
    expect(
      resolveAnalyticsConsentState({
        accountConsent: null,
        anonymousConsent: Option.some(grantedAnonymousConsent),
        hasBrowserPrivacySignal: false,
        isAccountConsentResolved: true,
        isAuthenticated: true,
        isAuthLoading: false,
      })
    ).toEqual({ scope: "account", status: "prompt" });
  });

  it("resolves current account decisions", () => {
    for (const granted of [true, false]) {
      expect(
        resolveAnalyticsConsentState({
          accountConsent: {
            granted,
            noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
          },
          anonymousConsent: Option.none(),
          hasBrowserPrivacySignal: false,
          isAccountConsentResolved: true,
          isAuthenticated: true,
          isAuthLoading: false,
        })
      ).toEqual({
        scope: "account",
        status: granted ? "granted" : "denied",
      });
    }
  });

  it("prompts for a missing anonymous decision", () => {
    const staleConsent = decodeAnonymousAnalyticsConsent(
      JSON.stringify({
        ...grantedAnonymousConsent,
        noticeVersion: "privacy-2025-01-01",
      })
    );

    expect(
      resolveAnalyticsConsentState({
        accountConsent: null,
        anonymousConsent: Option.none(),
        hasBrowserPrivacySignal: false,
        isAccountConsentResolved: false,
        isAuthenticated: false,
        isAuthLoading: false,
      })
    ).toEqual({ scope: "anonymous", status: "prompt" });
    expect(
      resolveAnalyticsConsentState({
        accountConsent: null,
        anonymousConsent: staleConsent,
        hasBrowserPrivacySignal: false,
        isAccountConsentResolved: false,
        isAuthenticated: false,
        isAuthLoading: false,
      })
    ).toEqual({ scope: "anonymous", status: "prompt" });
  });

  it("resolves current anonymous decisions", () => {
    expect(
      resolveAnalyticsConsentState({
        accountConsent: null,
        anonymousConsent: Option.some(grantedAnonymousConsent),
        hasBrowserPrivacySignal: false,
        isAccountConsentResolved: false,
        isAuthenticated: false,
        isAuthLoading: false,
      })
    ).toEqual({ scope: "anonymous", status: "granted" });
  });

  it("requires renewed grants while preserving prior anonymous denials", () => {
    expect(
      Option.getOrUndefined(
        decodeAnonymousAnalyticsConsent(JSON.stringify(retainedAnonymousGrant))
      )
    ).toEqual(retainedAnonymousGrant);
    expect(
      resolveAnalyticsConsentState({
        accountConsent: null,
        anonymousConsent: Option.some(retainedAnonymousGrant),
        hasBrowserPrivacySignal: false,
        isAccountConsentResolved: false,
        isAuthenticated: false,
        isAuthLoading: false,
      })
    ).toEqual({ scope: "anonymous", status: "prompt" });
    expect(
      resolveAnalyticsConsentState({
        accountConsent: null,
        anonymousConsent: Option.some(retainedAnonymousDenial),
        hasBrowserPrivacySignal: false,
        isAccountConsentResolved: false,
        isAuthenticated: false,
        isAuthLoading: false,
      })
    ).toEqual({ scope: "anonymous", status: "denied" });
  });

  it("requires renewed grants while preserving prior account denials", () => {
    const retainedAccountConsent = {
      granted: true,
      noticeVersion: CONSENT_NOTICE_VERSIONS[1],
    };

    expect(
      resolveAnalyticsConsentState({
        accountConsent: retainedAccountConsent,
        anonymousConsent: Option.none(),
        hasBrowserPrivacySignal: false,
        isAccountConsentResolved: true,
        isAuthenticated: true,
        isAuthLoading: false,
      })
    ).toEqual({ scope: "account", status: "prompt" });
    expect(
      resolveAnalyticsConsentState({
        accountConsent: { ...retainedAccountConsent, granted: false },
        anonymousConsent: Option.none(),
        hasBrowserPrivacySignal: false,
        isAccountConsentResolved: true,
        isAuthenticated: true,
        isAuthLoading: false,
      })
    ).toEqual({ scope: "account", status: "denied" });
  });
});
