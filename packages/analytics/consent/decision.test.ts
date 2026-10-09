import { describe, expect, it } from "@effect/vitest";
import {
  resolveConsentAffordances,
  resolveConsentError,
} from "@repo/analytics/consent/decision";

describe("consent affordance resolution", () => {
  const healthyAnonymous = {
    hasBrowserPrivacySignal: false,
    isAccountResolved: false,
    isAnonymousResolved: true,
    isAuthenticated: false,
    isBlocked: false,
  };

  it("lets an anonymous visitor decide until a privacy signal blocks grants", () => {
    expect(resolveConsentAffordances(healthyAnonymous)).toEqual({
      canDecline: true,
      canGrant: true,
    });
    expect(
      resolveConsentAffordances({
        ...healthyAnonymous,
        hasBrowserPrivacySignal: true,
      })
    ).toEqual({ canDecline: true, canGrant: false });
  });

  it("requires a resolved account before an authenticated visitor decides", () => {
    const authenticated = {
      ...healthyAnonymous,
      isAccountResolved: false,
      isAuthenticated: true,
    };

    expect(resolveConsentAffordances(authenticated)).toEqual({
      canDecline: false,
      canGrant: false,
    });
    expect(
      resolveConsentAffordances({ ...authenticated, isAccountResolved: true })
    ).toEqual({ canDecline: true, canGrant: true });
  });

  it("blocks every decision while loading, pending, or previewing", () => {
    expect(
      resolveConsentAffordances({ ...healthyAnonymous, isBlocked: true })
    ).toEqual({ canDecline: false, canGrant: false });
    expect(
      resolveConsentAffordances({
        ...healthyAnonymous,
        isAnonymousResolved: false,
      })
    ).toEqual({ canDecline: false, canGrant: false });
  });
});

describe("consent error resolution", () => {
  it("stays clear when every source is healthy", () => {
    expect(
      resolveConsentError({
        hasLoadError: false,
        hasRuntimeError: false,
        hasSaveError: false,
      })
    ).toBeNull();
  });

  it("prefers load errors over save and runtime errors", () => {
    expect(
      resolveConsentError({
        hasLoadError: true,
        hasRuntimeError: true,
        hasSaveError: true,
      })
    ).toBe("load");
  });

  it("prefers save errors over runtime errors", () => {
    expect(
      resolveConsentError({
        hasLoadError: false,
        hasRuntimeError: true,
        hasSaveError: true,
      })
    ).toBe("save");
  });

  it("surfaces runtime errors last", () => {
    expect(
      resolveConsentError({
        hasLoadError: false,
        hasRuntimeError: true,
        hasSaveError: false,
      })
    ).toBe("runtime");
  });
});
