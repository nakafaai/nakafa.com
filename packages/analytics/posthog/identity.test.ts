import { describe, expect, it } from "@effect/vitest";
import {
  type AnalyticsIdentityAuthorization,
  type AnalyticsTier,
  filterAuthorizedAnalyticsEvent,
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

const tiers: readonly AnalyticsTier[] = ["baseline", "granted"];
const authorizations: readonly AnalyticsIdentityAuthorization[] = [
  { status: "unresolved" },
  { status: "anonymous" },
  { status: "identified", userId: USER_ID },
];

describe("PostHog browser identity gate", () => {
  it.each(tiers)("admits anonymous events in every state (%s)", (tier) => {
    for (const authorization of authorizations) {
      expect(
        filterAuthorizedAnalyticsEvent(createEvent(), authorization, tier)
      ).toBeTruthy();
    }
    expect(
      filterAuthorizedAnalyticsEvent(null, { status: "unresolved" }, tier)
    ).toBeNull();
  });

  it("allows only the currently authorized identified user", () => {
    const currentUserEvent = createEvent(USER_ID);
    const otherUserEvent = createEvent("user-2");

    for (const tier of tiers) {
      expect(
        filterAuthorizedAnalyticsEvent(
          currentUserEvent,
          { status: "unresolved" },
          tier
        )
      ).toBeNull();
      expect(
        filterAuthorizedAnalyticsEvent(
          currentUserEvent,
          { status: "anonymous" },
          tier
        )
      ).toBeNull();
      expect(
        filterAuthorizedAnalyticsEvent(
          currentUserEvent,
          { status: "identified", userId: USER_ID },
          tier
        )
      ).toBe(currentUserEvent);
      expect(
        filterAuthorizedAnalyticsEvent(
          otherUserEvent,
          { status: "identified", userId: USER_ID },
          tier
        )
      ).toBeNull();
    }
  });

  it("minimizes baseline event URLs to origin plus pathname", () => {
    const event = createEvent(undefined, "$pageview", {
      $current_url: "https://nakafa.com/en/search?q=user+query#results",
      $referrer: "https://google.com/search?q=leaked",
      $referring_domain: "google.com",
    });

    const admitted = filterAuthorizedAnalyticsEvent(
      event,
      { status: "anonymous" },
      "baseline"
    );

    expect(admitted).not.toBe(event);
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

    const admitted = filterAuthorizedAnalyticsEvent(
      event,
      { status: "anonymous" },
      "baseline"
    );

    expect(admitted?.properties.$current_url).toBeNull();
    expect(admitted?.properties.$referrer).toBeNull();
  });

  it("keeps full URLs once the granted tier is active", () => {
    const event = createEvent(undefined, "$pageview", {
      $current_url: "https://nakafa.com/en/search?q=consented",
      $referrer: "https://google.com/search?q=consented",
    });

    const admitted = filterAuthorizedAnalyticsEvent(
      event,
      { status: "anonymous" },
      "granted"
    );

    expect(admitted).toBe(event);
  });
});
