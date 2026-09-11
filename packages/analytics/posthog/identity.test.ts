import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  authorizeAnalyticsIdentity,
  authorizeAnonymousAnalyticsIdentity,
  filterAuthorizedAnalyticsEvent,
  getAnalyticsTier,
  grantAnalyticsTier,
  initializeAnalyticsIdentityAuthorization,
  resetAnalyticsIdentity,
  revokeAnalyticsIdentity,
  revokeAnalyticsTier,
} from "@repo/analytics/posthog/identity";
import type { CaptureResult } from "posthog-js";

const USER_ID = "user-1";

function createEvent(
  userId?: string,
  event = "$pageview",
  properties: Record<string, unknown> = {}
): CaptureResult {
  return {
    event,
    properties: userId ? { $user_id: userId, ...properties } : properties,
    uuid: "019fa44c-02be-7cd0-a4ed-61a7af8e0620",
  };
}

describe("PostHog browser identity gate", () => {
  beforeEach(() => {
    initializeAnalyticsIdentityAuthorization();
  });

  it("admits anonymous events before auth resolves for baseline counting", () => {
    const anonymousEvent = createEvent();
    const identifiedEvent = createEvent(USER_ID);

    expect(filterAuthorizedAnalyticsEvent(anonymousEvent)).toBe(anonymousEvent);
    expect(filterAuthorizedAnalyticsEvent(identifiedEvent)).toBeNull();
    expect(filterAuthorizedAnalyticsEvent(null)).toBeNull();

    authorizeAnonymousAnalyticsIdentity();

    expect(filterAuthorizedAnalyticsEvent(anonymousEvent)).toBe(anonymousEvent);
    expect(filterAuthorizedAnalyticsEvent(identifiedEvent)).toBeNull();
  });

  it("allows only the currently authorized identified user", () => {
    const anonymousEvent = createEvent();
    const currentUserEvent = createEvent(USER_ID);
    const otherUserEvent = createEvent("user-2");

    expect(filterAuthorizedAnalyticsEvent(currentUserEvent)).toBeNull();

    authorizeAnalyticsIdentity(USER_ID);

    expect(filterAuthorizedAnalyticsEvent(currentUserEvent)).toBe(
      currentUserEvent
    );
    expect(filterAuthorizedAnalyticsEvent(anonymousEvent)).toBe(anonymousEvent);
    expect(filterAuthorizedAnalyticsEvent(otherUserEvent)).toBeNull();

    revokeAnalyticsIdentity();

    expect(filterAuthorizedAnalyticsEvent(currentUserEvent)).toBeNull();
    expect(filterAuthorizedAnalyticsEvent(anonymousEvent)).toBe(anonymousEvent);
  });

  it("minimizes baseline event URLs to origin plus pathname", () => {
    const event = createEvent(undefined, "$pageview", {
      $current_url: "https://nakafa.com/en/search?q=user+query#results",
      $referrer: "https://google.com/search?q=leaked",
      $referring_domain: "google.com",
    });

    const admitted = filterAuthorizedAnalyticsEvent(event);

    expect(admitted).not.toBeNull();
    expect(admitted?.properties.$current_url).toBe(
      "https://nakafa.com/en/search"
    );
    expect(admitted?.properties.$referrer).toBeNull();
    expect(admitted?.properties.$referring_domain).toBe("google.com");
  });

  it("drops unparseable baseline URLs instead of leaking them", () => {
    const event = createEvent(undefined, "$pageview", {
      $current_url: "not a url",
    });

    const admitted = filterAuthorizedAnalyticsEvent(event);

    expect(admitted?.properties.$current_url).toBeNull();
    expect(admitted?.properties.$referrer).toBeNull();
  });

  it("keeps full URLs once the granted tier is active", () => {
    grantAnalyticsTier();
    const event = createEvent(undefined, "$pageview", {
      $current_url: "https://nakafa.com/en/search?q=consented",
      $referrer: "https://google.com/search?q=consented",
    });

    const admitted = filterAuthorizedAnalyticsEvent(event);

    expect(admitted?.properties.$current_url).toBe(
      "https://nakafa.com/en/search?q=consented"
    );
    expect(admitted?.properties.$referrer).toBe(
      "https://google.com/search?q=consented"
    );
  });

  it("tracks the capture tier across grant and revoke transitions", () => {
    expect(getAnalyticsTier()).toBe("baseline");

    grantAnalyticsTier();
    expect(getAnalyticsTier()).toBe("granted");

    revokeAnalyticsTier();
    expect(getAnalyticsTier()).toBe("baseline");
  });

  it("returns the gate to baseline when authorization restarts", () => {
    grantAnalyticsTier();
    authorizeAnalyticsIdentity(USER_ID);

    initializeAnalyticsIdentityAuthorization();

    expect(getAnalyticsTier()).toBe("baseline");
    expect(filterAuthorizedAnalyticsEvent(createEvent(USER_ID))).toBeNull();
  });

  it("replaces analytics identity without changing capture consent", () => {
    const client = { reset: vi.fn() };

    resetAnalyticsIdentity(client, true);

    expect(client.reset).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("resets without forcing device rotation by default", () => {
    const client = { reset: vi.fn() };

    resetAnalyticsIdentity(client);

    expect(client.reset).toHaveBeenCalledExactlyOnceWith(false);
  });
});
