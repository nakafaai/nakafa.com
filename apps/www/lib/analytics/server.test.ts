// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  scheduleCurrentServerExceptionCapture,
  scheduleServerExceptionCapture,
} from "@/lib/analytics/server";

const analyticsMocks = vi.hoisted(() => ({
  after: vi.fn(),
  captureServerException: vi.fn(),
  cookies: vi.fn(),
  extractDistinctIdFromPostHogCookie: vi.fn(),
  isServerExceptionReportingEnabled: vi.fn(),
  tasks: [] as Array<() => unknown>,
}));

vi.mock("@repo/analytics/posthog/attribution", () => ({
  extractDistinctIdFromPostHogCookie:
    analyticsMocks.extractDistinctIdFromPostHogCookie,
}));

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException: analyticsMocks.captureServerException,
}));

vi.mock("@repo/analytics/server-reporting", () => ({
  isServerExceptionReportingEnabled:
    analyticsMocks.isServerExceptionReportingEnabled,
}));

vi.mock("next/headers", () => ({
  cookies: analyticsMocks.cookies,
}));

vi.mock("next/server", () => ({
  after: analyticsMocks.after,
}));

/** Returns the single request-time task registered with Next.js `after`. */
function getScheduledTask() {
  const [task] = analyticsMocks.tasks;
  if (!task) {
    throw new Error("Expected one scheduled analytics task.");
  }
  return task;
}

describe("request-time server exception reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyticsMocks.tasks.length = 0;
    analyticsMocks.after.mockImplementation((task) => {
      analyticsMocks.tasks.push(task);
    });
    analyticsMocks.isServerExceptionReportingEnabled.mockReturnValue(true);
  });

  it("does not read request state outside the production runtime", async () => {
    analyticsMocks.isServerExceptionReportingEnabled.mockReturnValue(false);

    await Effect.runPromise(
      scheduleCurrentServerExceptionCapture(new Error("preload failed"))
    );
    await Effect.runPromise(
      scheduleServerExceptionCapture(
        new Error("weather failed"),
        "ph_cookie=encoded"
      )
    );

    expect(analyticsMocks.after).not.toHaveBeenCalled();
    expect(analyticsMocks.cookies).not.toHaveBeenCalled();
  });

  it("reads cookies before scheduling provider work", async () => {
    const error = new Error("preload failed");
    const properties = { source: "settings" };
    analyticsMocks.cookies.mockResolvedValue({
      toString: () => "ph_cookie=encoded",
    });
    analyticsMocks.extractDistinctIdFromPostHogCookie.mockReturnValue(
      "viewer-2"
    );

    await Effect.runPromise(
      scheduleCurrentServerExceptionCapture(error, properties)
    );

    expect(analyticsMocks.cookies).toHaveBeenCalledOnce();
    expect(
      analyticsMocks.extractDistinctIdFromPostHogCookie
    ).toHaveBeenCalledWith("ph_cookie=encoded");
    expect(analyticsMocks.captureServerException).not.toHaveBeenCalled();

    await getScheduledTask()();

    expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
      error,
      "viewer-2",
      properties
    );
  });

  it("schedules a known request cookie without reading Next request state", async () => {
    const error = new Error("weather failed");
    analyticsMocks.extractDistinctIdFromPostHogCookie.mockReturnValue(
      "viewer-3"
    );

    await Effect.runPromise(
      scheduleServerExceptionCapture(error, "ph_cookie=encoded", {
        source: "weather-api",
      })
    );

    expect(analyticsMocks.cookies).not.toHaveBeenCalled();
    expect(
      analyticsMocks.extractDistinctIdFromPostHogCookie
    ).toHaveBeenCalledWith("ph_cookie=encoded");

    await getScheduledTask()();
    expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
      error,
      "viewer-3",
      { source: "weather-api" }
    );
  });

  it("contains provider failures inside the request task", async () => {
    analyticsMocks.cookies.mockResolvedValue({ toString: () => "" });
    analyticsMocks.captureServerException.mockRejectedValue(
      new Error("provider unavailable")
    );

    await Effect.runPromise(
      scheduleCurrentServerExceptionCapture(new Error("preload failed"))
    );

    await expect(getScheduledTask()()).resolves.toBeUndefined();
  });

  it("uses anonymous attribution for a request with no cookies", async () => {
    const error = new Error("preload failed");
    analyticsMocks.cookies.mockResolvedValue({ toString: () => "" });
    analyticsMocks.extractDistinctIdFromPostHogCookie.mockReturnValue(
      undefined
    );

    await Effect.runPromise(scheduleCurrentServerExceptionCapture(error));

    expect(
      analyticsMocks.extractDistinctIdFromPostHogCookie
    ).toHaveBeenCalledWith("");
    await getScheduledTask()();
    expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
      error,
      undefined,
      undefined
    );
  });

  it("does not schedule work when request cookies cannot be read", async () => {
    analyticsMocks.cookies.mockRejectedValue(new Error("request unavailable"));

    await Effect.runPromise(
      scheduleCurrentServerExceptionCapture(new Error("preload failed"))
    );

    expect(analyticsMocks.after).not.toHaveBeenCalled();
    expect(
      analyticsMocks.extractDistinctIdFromPostHogCookie
    ).not.toHaveBeenCalled();
    expect(analyticsMocks.captureServerException).not.toHaveBeenCalled();
  });

  it("contains request scheduling failures", async () => {
    analyticsMocks.cookies.mockResolvedValue({ toString: () => "" });
    analyticsMocks.after.mockImplementation(() => {
      throw new Error("request already closed");
    });

    await expect(
      Effect.runPromise(
        scheduleCurrentServerExceptionCapture(new Error("preload failed"))
      )
    ).resolves.toBeUndefined();
    expect(analyticsMocks.captureServerException).not.toHaveBeenCalled();
  });
});
