import {
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
  createAnonymousAnalyticsConsent,
} from "@repo/analytics/consent";
import { Option } from "effect";
import { describe, expect, it } from "vitest";
import {
  type BrowserAnalyticsUser,
  createBrowserAnalyticsIdentity,
  resolveBrowserAnalyticsConsentState,
  shouldPersistAnonymousAnalyticsDenial,
  shouldRevokeAccountAnalyticsGrant,
} from "@/lib/analytics/consent-state";

const anonymousConsent = createAnonymousAnalyticsConsent("granted", 100);
const accountConsent = {
  category: ANALYTICS_CONSENT_CATEGORY,
  decidedAt: 200,
  granted: true,
  mechanism: ANALYTICS_CONSENT_MECHANISM,
  noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
};
const user = {
  appUser: {
    _id: "user-1",
    plan: "free",
    role: "student",
  },
} satisfies BrowserAnalyticsUser;
const userWithoutRole = {
  ...user,
  appUser: { ...user.appUser, role: undefined },
} satisfies BrowserAnalyticsUser;

describe("browser analytics consent state", () => {
  it("persists an anonymous denial after a signal or account withdrawal", () => {
    const unresolvedBrowser = {
      anonymousConsent: Option.none(),
      hasBrowserPrivacySignal: true,
      isResolved: false,
    };
    const resolvedBrowser = { ...unresolvedBrowser, isResolved: true };

    expect(
      shouldPersistAnonymousAnalyticsDenial({
        accountConsent,
        browserConsent: unresolvedBrowser,
        isAuthenticated: true,
      })
    ).toBe(false);
    expect(
      shouldPersistAnonymousAnalyticsDenial({
        accountConsent,
        browserConsent: resolvedBrowser,
        isAuthenticated: true,
      })
    ).toBe(true);
    expect(
      shouldPersistAnonymousAnalyticsDenial({
        accountConsent: { ...accountConsent, granted: false },
        browserConsent: {
          ...resolvedBrowser,
          hasBrowserPrivacySignal: false,
        },
        isAuthenticated: true,
      })
    ).toBe(true);
    expect(
      shouldPersistAnonymousAnalyticsDenial({
        accountConsent,
        browserConsent: {
          ...resolvedBrowser,
          anonymousConsent: Option.some(anonymousConsent),
        },
        isAuthenticated: true,
      })
    ).toBe(true);
    expect(
      Reflect.apply(shouldPersistAnonymousAnalyticsDenial, undefined, [
        {
          accountConsent,
          browserConsent: {
            ...resolvedBrowser,
            anonymousConsent: Option.some({
              ...createAnonymousAnalyticsConsent("denied", 100),
              noticeVersion: "privacy-retained",
            }),
          },
          isAuthenticated: true,
        },
      ])
    ).toBe(true);
    expect(
      shouldPersistAnonymousAnalyticsDenial({
        accountConsent,
        browserConsent: {
          ...resolvedBrowser,
          anonymousConsent: Option.some(
            createAnonymousAnalyticsConsent("denied", 100)
          ),
        },
        isAuthenticated: true,
      })
    ).toBe(false);
    expect(
      shouldPersistAnonymousAnalyticsDenial({
        accountConsent,
        browserConsent: {
          ...resolvedBrowser,
          hasBrowserPrivacySignal: false,
        },
        isAuthenticated: true,
      })
    ).toBe(false);
  });

  it("revokes only a current account grant overridden by a browser signal", () => {
    const browserConsent = {
      anonymousConsent: Option.none(),
      hasBrowserPrivacySignal: true,
      isResolved: true,
    };

    expect(
      shouldRevokeAccountAnalyticsGrant({
        accountConsent,
        browserConsent,
        isAccountConsentResolved: true,
        isAuthenticated: true,
      })
    ).toBe(true);
    expect(
      shouldRevokeAccountAnalyticsGrant({
        accountConsent: { ...accountConsent, granted: false },
        browserConsent,
        isAccountConsentResolved: true,
        isAuthenticated: true,
      })
    ).toBe(false);
    expect(
      shouldRevokeAccountAnalyticsGrant({
        accountConsent,
        browserConsent: {
          ...browserConsent,
          hasBrowserPrivacySignal: false,
        },
        isAccountConsentResolved: true,
        isAuthenticated: true,
      })
    ).toBe(false);
    expect(
      shouldRevokeAccountAnalyticsGrant({
        accountConsent,
        browserConsent,
        isAccountConsentResolved: false,
        isAuthenticated: true,
      })
    ).toBe(false);
    expect(
      shouldRevokeAccountAnalyticsGrant({
        accountConsent: null,
        browserConsent,
        isAccountConsentResolved: true,
        isAuthenticated: true,
      })
    ).toBe(false);
    expect(
      shouldRevokeAccountAnalyticsGrant({
        accountConsent,
        browserConsent,
        isAccountConsentResolved: true,
        isAuthenticated: false,
      })
    ).toBe(false);
  });

  it("keeps preview children disabled", () => {
    expect(
      resolveBrowserAnalyticsConsentState({
        accountConsent,
        browserConsent: {
          anonymousConsent: Option.some(anonymousConsent),
          hasBrowserPrivacySignal: false,
          isResolved: true,
        },
        isAccountConsentResolved: true,
        isAuthenticated: true,
        isAuthLoading: false,
        isPreviewChild: true,
        isUserPending: false,
        user,
      })
    ).toEqual({ status: "browser-signal" });
  });

  it.each([
    {
      browserConsent: {
        anonymousConsent: Option.none(),
        hasBrowserPrivacySignal: false,
        isResolved: false,
      },
      isAuthenticated: false,
      isAuthLoading: true,
      isUserPending: false,
      name: "auth loading",
    },
    {
      browserConsent: {
        anonymousConsent: Option.none(),
        hasBrowserPrivacySignal: false,
        isResolved: false,
      },
      isAuthenticated: false,
      isAuthLoading: false,
      isUserPending: true,
      name: "user loading",
    },
    {
      browserConsent: {
        anonymousConsent: Option.none(),
        hasBrowserPrivacySignal: false,
        isResolved: true,
      },
      isAuthenticated: true,
      isAuthLoading: false,
      isUserPending: false,
      name: "missing authenticated user",
    },
    {
      browserConsent: {
        anonymousConsent: Option.none(),
        hasBrowserPrivacySignal: false,
        isResolved: false,
      },
      isAuthenticated: false,
      isAuthLoading: false,
      isUserPending: false,
      name: "anonymous storage loading",
    },
  ])("keeps $name pending", (input) => {
    expect(
      resolveBrowserAnalyticsConsentState({
        accountConsent: null,
        browserConsent: input.browserConsent,
        isAccountConsentResolved: false,
        isAuthenticated: input.isAuthenticated,
        isAuthLoading: input.isAuthLoading,
        isPreviewChild: false,
        isUserPending: input.isUserPending,
        user: null,
      })
    ).toEqual({ status: "pending" });
  });

  it("resolves both anonymous and authenticated grants", () => {
    expect(
      resolveBrowserAnalyticsConsentState({
        accountConsent: null,
        browserConsent: {
          anonymousConsent: Option.some(anonymousConsent),
          hasBrowserPrivacySignal: false,
          isResolved: true,
        },
        isAccountConsentResolved: false,
        isAuthenticated: false,
        isAuthLoading: false,
        isPreviewChild: false,
        isUserPending: false,
        user: null,
      })
    ).toEqual({ scope: "anonymous", status: "granted" });
    expect(
      resolveBrowserAnalyticsConsentState({
        accountConsent,
        browserConsent: {
          anonymousConsent: Option.none(),
          hasBrowserPrivacySignal: false,
          isResolved: true,
        },
        isAccountConsentResolved: true,
        isAuthenticated: true,
        isAuthLoading: false,
        isPreviewChild: false,
        isUserPending: false,
        user,
      })
    ).toEqual({ scope: "account", status: "granted" });
  });

  it("projects anonymous decision evidence without account identity", () => {
    expect(
      createBrowserAnalyticsIdentity({
        accountConsent: null,
        anonymousConsent: Option.some(anonymousConsent),
        isAuthenticated: false,
        status: "granted",
        user: null,
      })
    ).toEqual({
      consentDecidedAt: 100,
      consentMechanism: "privacy-controls",
      consentNoticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      status: "anonymous",
    });
    expect(
      createBrowserAnalyticsIdentity({
        accountConsent: null,
        anonymousConsent: Option.none(),
        isAuthenticated: false,
        status: "granted",
        user: null,
      })
    ).toBeNull();
    expect(
      createBrowserAnalyticsIdentity({
        accountConsent,
        anonymousConsent: Option.none(),
        isAuthenticated: true,
        status: "granted",
        user: userWithoutRole,
      })
    ).toMatchObject({ role: null });
  });

  it("projects only a proven signed-in account grant", () => {
    expect(
      createBrowserAnalyticsIdentity({
        accountConsent,
        anonymousConsent: Option.none(),
        isAuthenticated: true,
        status: "granted",
        user,
      })
    ).toEqual({
      consentDecidedAt: 200,
      consentMechanism: "privacy-controls",
      consentNoticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      plan: "free",
      role: "student",
      status: "identified",
      userId: "user-1",
    });
    expect(
      createBrowserAnalyticsIdentity({
        accountConsent: null,
        anonymousConsent: Option.some(anonymousConsent),
        isAuthenticated: true,
        status: "granted",
        user,
      })
    ).toBeNull();
    expect(
      createBrowserAnalyticsIdentity({
        accountConsent: { ...accountConsent, granted: false },
        anonymousConsent: Option.none(),
        isAuthenticated: true,
        status: "granted",
        user,
      })
    ).toBeNull();
    expect(
      createBrowserAnalyticsIdentity({
        accountConsent,
        anonymousConsent: Option.none(),
        isAuthenticated: true,
        status: "granted",
        user: null,
      })
    ).toBeNull();
  });

  it("does not authorize unresolved or denied state", () => {
    for (const status of [
      "pending",
      "prompt",
      "denied",
      "browser-signal",
    ] as const) {
      expect(
        createBrowserAnalyticsIdentity({
          accountConsent,
          anonymousConsent: Option.some(anonymousConsent),
          isAuthenticated: true,
          status,
          user,
        })
      ).toBeNull();
    }
  });

  it("does not authorize retained decisions governed by an older notice", () => {
    expect(
      Reflect.apply(createBrowserAnalyticsIdentity, undefined, [
        {
          accountConsent: null,
          anonymousConsent: Option.some({
            ...anonymousConsent,
            noticeVersion: "privacy-retained",
          }),
          isAuthenticated: false,
          status: "granted",
          user: null,
        },
      ])
    ).toBeNull();
    expect(
      Reflect.apply(createBrowserAnalyticsIdentity, undefined, [
        {
          accountConsent: {
            ...accountConsent,
            noticeVersion: "privacy-retained",
          },
          anonymousConsent: Option.none(),
          isAuthenticated: true,
          status: "granted",
          user,
        },
      ])
    ).toBeNull();
  });
});
