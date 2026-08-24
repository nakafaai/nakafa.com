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
  clearAnalyticsConsentSessionOverride,
  createAnalyticsConsentPromptIdentity,
  createBrowserAnalyticsIdentity,
  resolveAnalyticsConsentSessionPolicy,
  resolveBrowserAnalyticsConsentState,
  setAnalyticsConsentSessionOverride,
  shouldPersistAnonymousAnalyticsDenial,
  shouldRevokeAccountAnalyticsGrant,
} from "@/lib/analytics/consent/state";

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
      user: { appUser: { ...user.appUser, _id: "user-2" } },
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
      override: { granted: true, persistence: "failed" },
      overrides: new Map(),
      promptIdentity: anonymous,
    });
    overrides = setAnalyticsConsentSessionOverride({
      override: { granted: false, persistence: "failed" },
      overrides,
      promptIdentity: accountA,
    });
    overrides = setAnalyticsConsentSessionOverride({
      override: { granted: true, persistence: "pending" },
      overrides,
      promptIdentity: accountB,
    });
    overrides = clearAnalyticsConsentSessionOverride({
      overrides,
      promptIdentity: accountB,
    });
    const resolveFor = (promptIdentity: typeof accountA) =>
      resolveAnalyticsConsentSessionPolicy({
        hasLoadError: false,
        overrides,
        promptIdentity,
        status: "granted",
      });
    expect(
      [anonymous, accountA, accountB, accountA]
        .map(resolveFor)
        .map((policy) => [policy.hasSaveError, policy.isRuntimeSuppressed])
    ).toEqual([
      [true, true],
      [true, true],
      [false, false],
      [true, true],
    ]);
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
      hasLoadError: true,
      overrides: new Map(),
      promptIdentity,
      status: "pending",
    });
    const pending = resolveAnalyticsConsentSessionPolicy({
      hasLoadError: true,
      overrides: new Map([
        [promptIdentity, { granted: true, persistence: "pending" }],
      ]),
      promptIdentity,
      status: "pending",
    });
    expect([unresolved.isPromptOpen, pending.isPromptOpen]).toEqual([
      true,
      false,
    ]);
    expect(pending.isSaving).toBe(true);
    expect(
      resolveAnalyticsConsentSessionPolicy({
        hasLoadError: false,
        overrides: new Map(),
        promptIdentity,
        status: "prompt",
      }).isPromptOpen
    ).toBe(true);
    expect(
      resolveAnalyticsConsentSessionPolicy({
        hasLoadError: true,
        overrides: new Map(),
        promptIdentity: null,
        status: "pending",
      }).isPromptOpen
    ).toBe(false);
  });

  it("persists an anonymous denial after a signal or account withdrawal", () => {
    const unresolvedBrowser = {
      anonymousConsent: Option.none(),
      hasBrowserPrivacySignal: true,
      isResolved: false,
    };
    const resolvedBrowser = { ...unresolvedBrowser, isResolved: true };
    const inputs = [
      {
        accountConsent,
        browserConsent: unresolvedBrowser,
        isAuthenticated: true,
      },
      {
        accountConsent,
        browserConsent: resolvedBrowser,
        isAuthenticated: true,
      },
      {
        accountConsent: { ...accountConsent, granted: false },
        browserConsent: { ...resolvedBrowser, hasBrowserPrivacySignal: false },
        isAuthenticated: true,
      },
      {
        accountConsent,
        browserConsent: {
          ...resolvedBrowser,
          anonymousConsent: Option.some(anonymousConsent),
        },
        isAuthenticated: true,
      },
      {
        accountConsent,
        browserConsent: {
          ...resolvedBrowser,
          anonymousConsent: Option.some(
            createAnonymousAnalyticsConsent("denied", 100)
          ),
        },
        isAuthenticated: true,
      },
      {
        accountConsent,
        browserConsent: { ...resolvedBrowser, hasBrowserPrivacySignal: false },
        isAuthenticated: true,
      },
    ];

    expect(
      inputs.map((input) => shouldPersistAnonymousAnalyticsDenial(input))
    ).toEqual([false, true, true, true, false, false]);
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
  });

  it("revokes only a current account grant overridden by a browser signal", () => {
    const browserConsent = {
      anonymousConsent: Option.none(),
      hasBrowserPrivacySignal: true,
      isResolved: true,
    };
    const baseInput = {
      accountConsent,
      browserConsent,
      isAccountConsentResolved: true,
      isAuthenticated: true,
    };
    const inputs = [
      baseInput,
      {
        ...baseInput,
        accountConsent: { ...accountConsent, granted: false },
      },
      {
        ...baseInput,
        browserConsent: { ...browserConsent, hasBrowserPrivacySignal: false },
      },
      { ...baseInput, isAccountConsentResolved: false },
      { ...baseInput, accountConsent: null },
      { ...baseInput, isAuthenticated: false },
    ];

    expect(
      inputs.map((input) =>
        shouldRevokeAccountAnalyticsGrant({
          accountConsent: input.accountConsent,
          browserConsent: input.browserConsent,
          isAccountConsentResolved: input.isAccountConsentResolved,
          isAuthenticated: input.isAuthenticated,
        })
      )
    ).toEqual([true, false, false, false, false, false]);
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
