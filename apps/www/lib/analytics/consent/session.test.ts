import {
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import { describe, expect, it } from "vitest";
import {
  clearAnalyticsConsentSessionOverride,
  createAnalyticsConsentPromptIdentity,
  resolveAnalyticsConsentSessionPolicy,
  setAnalyticsConsentSessionOverride,
} from "@/lib/analytics/consent/session";

const accountConsent = {
  category: ANALYTICS_CONSENT_CATEGORY,
  decidedAt: 200,
  granted: true,
  mechanism: ANALYTICS_CONSENT_MECHANISM,
  noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
};
const user = { appUser: { _id: "user-1" } };
type SessionPolicyInput = Parameters<
  typeof resolveAnalyticsConsentSessionPolicy
>[0];

describe("analytics consent session", () => {
  it("keeps failures scoped and clears synchronized choices", () => {
    const anonymous = createAnalyticsConsentPromptIdentity({
      isAuthenticated: false,
      user: null,
    });
    const accountA = createAnalyticsConsentPromptIdentity({
      isAuthenticated: true,
      user,
    });
    const accountB = createAnalyticsConsentPromptIdentity({
      isAuthenticated: true,
      user: { appUser: { _id: "user-2" } },
    });
    expect(accountA).toBe(`account:user-1:${ANALYTICS_CONSENT_NOTICE_VERSION}`);
    expect(
      createAnalyticsConsentPromptIdentity({
        isAuthenticated: true,
        user: null,
      })
    ).toBeNull();
    if (!(anonymous && accountA && accountB)) {
      return;
    }

    let overrides = setAnalyticsConsentSessionOverride({
      override: { persistence: "failed" },
      overrides: new Map(),
      promptIdentity: anonymous,
    });
    overrides = setAnalyticsConsentSessionOverride({
      override: { persistence: "failed" },
      overrides,
      promptIdentity: accountA,
    });
    overrides = setAnalyticsConsentSessionOverride({
      override: { decidedAt: 300, persistence: "saved" },
      overrides,
      promptIdentity: accountB,
    });
    const currentSource = { ...accountConsent, decidedAt: 300 };
    const resolve = (
      promptIdentity: typeof accountA,
      durableConsent: SessionPolicyInput["durableConsent"] = null,
      status: SessionPolicyInput["status"] = "granted"
    ) =>
      resolveAnalyticsConsentSessionPolicy({
        durableConsent,
        hasLoadError: false,
        overrides,
        promptIdentity,
        status,
      });

    expect(
      [
        resolve(anonymous),
        resolve(accountA),
        resolve(accountB),
        resolve(accountB, { ...currentSource, decidedAt: 299 }),
        resolve(accountB, {
          ...currentSource,
          noticeVersion: "privacy-retained",
        }),
        resolve(accountB, currentSource),
      ].map((policy) => [
        policy.hasSaveError,
        policy.isRuntimeSuppressed,
        policy.status,
      ])
    ).toEqual([
      [true, true, "denied"],
      [true, true, "denied"],
      [false, true, "denied"],
      [false, true, "denied"],
      [false, true, "denied"],
      [false, false, "granted"],
    ]);
    expect(resolve(anonymous, null, "browser-signal").status).toBe(
      "browser-signal"
    );

    const cleared = clearAnalyticsConsentSessionOverride({
      overrides,
      promptIdentity: accountA,
    });
    expect(cleared.has(accountA)).toBe(false);
    expect(
      clearAnalyticsConsentSessionOverride({
        overrides: cleared,
        promptIdentity: accountA,
      })
    ).toBe(cleared);
  });

  it("shows a prompt only until that visitor has a pending choice", () => {
    const promptIdentity = createAnalyticsConsentPromptIdentity({
      isAuthenticated: false,
      user: null,
    });
    if (!promptIdentity) {
      return;
    }

    const unresolved = resolveAnalyticsConsentSessionPolicy({
      durableConsent: null,
      hasLoadError: true,
      overrides: new Map(),
      promptIdentity,
      status: "pending",
    });
    const pending = resolveAnalyticsConsentSessionPolicy({
      durableConsent: null,
      hasLoadError: true,
      overrides: new Map([[promptIdentity, { persistence: "pending" }]]),
      promptIdentity,
      status: "pending",
    });
    expect([unresolved.isPromptOpen, pending.isPromptOpen]).toEqual([
      true,
      false,
    ]);
    expect(pending.isSaving).toBe(true);
    expect(pending.isRuntimeSuppressed).toBe(true);
    expect(pending.status).toBe("pending");
    expect(
      resolveAnalyticsConsentSessionPolicy({
        durableConsent: null,
        hasLoadError: false,
        overrides: new Map(),
        promptIdentity,
        status: "prompt",
      })
    ).toMatchObject({ isPromptOpen: true, status: "prompt" });
    expect(
      resolveAnalyticsConsentSessionPolicy({
        durableConsent: null,
        hasLoadError: true,
        overrides: new Map(),
        promptIdentity: null,
        status: "pending",
      }).isPromptOpen
    ).toBe(false);
  });
});
