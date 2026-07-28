import {
  authorizeAnalyticsIdentity,
  filterAuthorizedAnalyticsEvent,
  revokeAnalyticsIdentity,
} from "@repo/analytics/posthog/identity";
import type { CaptureResult } from "posthog-js";
import { beforeEach, describe, expect, it } from "vitest";

const USER_ID = "user-1";

function createEvent(userId?: string): CaptureResult {
  return {
    event: "$pageview",
    properties: userId ? { $user_id: userId } : {},
    uuid: "019fa44c-02be-7cd0-a4ed-61a7af8e0620",
  };
}

describe("PostHog browser identity gate", () => {
  beforeEach(() => {
    revokeAnalyticsIdentity();
  });

  it("allows anonymous events without an auth dependency", () => {
    const event = createEvent();

    expect(filterAuthorizedAnalyticsEvent(event)).toBe(event);
    expect(filterAuthorizedAnalyticsEvent(null)).toBeNull();
  });

  it("allows only the currently authorized identified user", () => {
    const currentUserEvent = createEvent(USER_ID);
    const otherUserEvent = createEvent("user-2");

    expect(filterAuthorizedAnalyticsEvent(currentUserEvent)).toBeNull();

    authorizeAnalyticsIdentity(USER_ID);

    expect(filterAuthorizedAnalyticsEvent(currentUserEvent)).toBe(
      currentUserEvent
    );
    expect(filterAuthorizedAnalyticsEvent(otherUserEvent)).toBeNull();

    revokeAnalyticsIdentity();

    expect(filterAuthorizedAnalyticsEvent(currentUserEvent)).toBeNull();
  });
});
