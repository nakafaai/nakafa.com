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
  isServerExceptionReportingEnabled: vi.fn(),
  tasks: [] as Array<() => unknown>,
}));

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException: analyticsMocks.captureServerException,
}));

vi.mock("@repo/analytics/server-reporting", () => ({
  isServerExceptionReportingEnabled:
    analyticsMocks.isServerExceptionReportingEnabled,
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

  it("does not schedule outside the production runtime", async () => {
    analyticsMocks.isServerExceptionReportingEnabled.mockReturnValue(false);

    await Effect.runPromise(
      scheduleCurrentServerExceptionCapture(new Error("preload failed"), {
        source: "disabled-current-test",
      })
    );
    await Effect.runPromise(
      scheduleServerExceptionCapture(new Error("weather failed"), {
        source: "disabled-explicit-test",
      })
    );

    expect(analyticsMocks.after).not.toHaveBeenCalled();
  });

  it("schedules the current operational exception without identity", async () => {
    const error = new Error("preload failed");
    const properties = { source: "settings" };

    await Effect.runPromise(
      scheduleCurrentServerExceptionCapture(error, properties)
    );

    expect(analyticsMocks.captureServerException).not.toHaveBeenCalled();

    await getScheduledTask()();

    expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
      error,
      properties
    );
  });

  it("schedules an explicitly provided operational exception", async () => {
    const error = new Error("weather failed");

    await Effect.runPromise(
      scheduleServerExceptionCapture(error, {
        source: "weather-api",
      })
    );

    await getScheduledTask()();
    expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(error, {
      source: "weather-api",
    });
  });

  it("contains provider failures inside the request task", async () => {
    analyticsMocks.captureServerException.mockRejectedValue(
      new Error("provider unavailable")
    );

    await Effect.runPromise(
      scheduleCurrentServerExceptionCapture(new Error("preload failed"), {
        source: "provider-failure-test",
      })
    );

    await expect(getScheduledTask()()).resolves.toBeUndefined();
  });

  it("contains request scheduling failures", async () => {
    analyticsMocks.after.mockImplementation(() => {
      throw new Error("request already closed");
    });

    await expect(
      Effect.runPromise(
        scheduleCurrentServerExceptionCapture(new Error("preload failed"), {
          source: "scheduling-failure-test",
        })
      )
    ).resolves.toBeUndefined();
    expect(analyticsMocks.captureServerException).not.toHaveBeenCalled();
  });
});
