// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
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
const getScheduledTask = Effect.fn("www.analytics.test.getScheduledTask")(() =>
  Effect.fromNullishOr(analyticsMocks.tasks[0])
);

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

  it.effect("does not schedule outside the production runtime", () =>
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

  it.effect(
    "schedules the current operational exception without identity",
    () =>
      Effect.gen(function* () {
        const error = new Error("preload failed");
        const properties = { source: "settings" };

        yield* scheduleCurrentServerExceptionCapture(error, properties);

        expect(analyticsMocks.captureServerException).not.toHaveBeenCalled();

        const task = yield* getScheduledTask();
        yield* Effect.promise(() => Promise.resolve(task()));

        expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
          error,
          properties
        );
      })
  );

  it.effect("schedules an explicitly provided operational exception", () =>
    Effect.gen(function* () {
      const error = new Error("weather failed");

      yield* scheduleServerExceptionCapture(error, {
        source: "weather-api",
      });

      const task = yield* getScheduledTask();
      yield* Effect.promise(() => Promise.resolve(task()));
      expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
        error,
        {
          source: "weather-api",
        }
      );
    })
  );

  it.effect("contains provider failures inside the request task", () =>
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

      const task = yield* getScheduledTask();
      yield* Effect.promise(() => expect(task()).resolves.toBeUndefined());
    })
  );

  it.effect("contains request scheduling failures", () =>
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
