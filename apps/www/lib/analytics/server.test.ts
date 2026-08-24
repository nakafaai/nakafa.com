// @vitest-environment node

import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { vi } from "vitest";
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
    analyticsMocks.captureServerException.mockReturnValue(Effect.void);
    analyticsMocks.after.mockImplementation((task) => {
      analyticsMocks.tasks.push(task);
    });
    analyticsMocks.isServerExceptionReportingEnabled.mockReturnValue(true);
  });

  it.live("does not schedule outside the production runtime", () =>
    Effect.gen(function* () {
      analyticsMocks.isServerExceptionReportingEnabled.mockReturnValue(false);

      yield* scheduleCurrentServerExceptionCapture(
        new Error("preload failed"),
        {
          source: "disabled-current-test",
        }
      );
      yield* scheduleServerExceptionCapture(new Error("weather failed"), {
        source: "disabled-explicit-test",
      });

      expect(analyticsMocks.after).not.toHaveBeenCalled();
    })
  );

  it.live("schedules the current operational exception without identity", () =>
    Effect.gen(function* () {
      const error = new Error("preload failed");
      const properties = { source: "settings" };

      yield* scheduleCurrentServerExceptionCapture(error, properties);

      expect(analyticsMocks.captureServerException).not.toHaveBeenCalled();

      yield* Effect.promise(() => Promise.resolve(getScheduledTask()()));

      expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
        error,
        properties
      );
    })
  );

  it.live("schedules an explicitly provided operational exception", () =>
    Effect.gen(function* () {
      const error = new Error("weather failed");

      yield* scheduleServerExceptionCapture(error, {
        source: "weather-api",
      });

      yield* Effect.promise(() => Promise.resolve(getScheduledTask()()));
      expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
        error,
        {
          source: "weather-api",
        }
      );
    })
  );

  it.live("contains provider failures inside the request task", () =>
    Effect.gen(function* () {
      analyticsMocks.captureServerException.mockReturnValue(
        Effect.fail({ cause: new Error("provider unavailable") })
      );

      yield* scheduleCurrentServerExceptionCapture(
        new Error("preload failed"),
        {
          source: "provider-failure-test",
        }
      );

      yield* Effect.promise(() =>
        expect(getScheduledTask()()).resolves.toBeUndefined()
      );
    })
  );

  it.live("contains request scheduling failures", () =>
    Effect.gen(function* () {
      analyticsMocks.after.mockImplementation(() => {
        throw new Error("request already closed");
      });

      expect(
        yield* scheduleCurrentServerExceptionCapture(
          new Error("preload failed"),
          {
            source: "scheduling-failure-test",
          }
        )
      ).toBeUndefined();
      expect(analyticsMocks.captureServerException).not.toHaveBeenCalled();
    })
  );
});
