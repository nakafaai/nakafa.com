import {
  authorizeAnalyticsIdentity,
  authorizeAnonymousAnalyticsIdentity,
  filterAuthorizedAnalyticsEvent,
  resetAnalyticsIdentity,
  resetPersistedAnalyticsIdentity,
  revokeAnalyticsIdentity,
} from "@repo/analytics/posthog/identity";
import type { CaptureResult } from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("drops every event until auth resolves anonymously", () => {
    const anonymousEvent = createEvent();
    const identifiedEvent = createEvent(USER_ID);

    expect(filterAuthorizedAnalyticsEvent(anonymousEvent)).toBeNull();
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
    expect(filterAuthorizedAnalyticsEvent(anonymousEvent)).toBeNull();
    expect(filterAuthorizedAnalyticsEvent(otherUserEvent)).toBeNull();

    revokeAnalyticsIdentity();

    expect(filterAuthorizedAnalyticsEvent(currentUserEvent)).toBeNull();
  });

  it("replaces analytics identity while preserving capture consent", () => {
    const optedOutClient = {
      get_property: () => "deleted-user",
      has_opted_out_capturing: () => true,
      opt_out_capturing: vi.fn(),
      reset: vi.fn(),
    };

    resetAnalyticsIdentity(optedOutClient, true);

    expect(optedOutClient.reset).toHaveBeenCalledExactlyOnceWith(true);
    expect(optedOutClient.opt_out_capturing).toHaveBeenCalledOnce();
  });

  it("replaces analytics identity without adding an opt-out", () => {
    const capturingClient = {
      get_property: () => "deleted-user",
      has_opted_out_capturing: () => false,
      opt_out_capturing: vi.fn(),
      reset: vi.fn(),
    };

    resetAnalyticsIdentity(capturingClient);

    expect(capturingClient.reset).toHaveBeenCalledExactlyOnceWith(false);
    expect(capturingClient.opt_out_capturing).not.toHaveBeenCalled();
  });

  it("removes only a persisted identified analytics user on startup", () => {
    const identifiedClient = {
      get_property: () => "deleted-user",
      has_opted_out_capturing: () => false,
      opt_out_capturing: vi.fn(),
      reset: vi.fn(),
    };
    const anonymousClient = {
      ...identifiedClient,
      get_property: () => undefined,
      reset: vi.fn(),
    };

    resetPersistedAnalyticsIdentity(identifiedClient);
    resetPersistedAnalyticsIdentity(anonymousClient);

    expect(identifiedClient.reset).toHaveBeenCalledExactlyOnceWith(false);
    expect(anonymousClient.reset).not.toHaveBeenCalled();
  });
});
