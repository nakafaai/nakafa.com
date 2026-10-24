// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import {
  scheduleCurrentServerExceptionCapture,
  scheduleServerExceptionCapture,
} from "@/lib/analytics/exception.server";

const userAgent = "Mozilla/5.0 (compatible; Googlebot/2.1)";

const analyticsMocks = vi.hoisted(() => {
  const tasks: (() => Promise<unknown>)[] = [];
  return {
    captureServerException: vi.fn(),
    getRequestHeader: vi.fn(),
    isServerExceptionReportingEnabled: vi.fn(),
    tasks,
    waitUntil: vi.fn(),
  };
});

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException: analyticsMocks.captureServerException,
}));

vi.mock("@repo/analytics/server-reporting", () => ({
  isServerExceptionReportingEnabled:
    analyticsMocks.isServerExceptionReportingEnabled,
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: analyticsMocks.getRequestHeader,
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: analyticsMocks.waitUntil,
}));

/** Waits for the single request-time task registered with the platform `waitUntil`. */
const settleScheduledTask = Effect.fn("www.analytics.test.settleScheduledTask")(
  function* () {
    const task = yield* Effect.fromNullishOr(analyticsMocks.tasks[0]);
    yield* Effect.promise(() => task());
  }
);

describe("request-time server exception reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyticsMocks.tasks.length = 0;
    analyticsMocks.captureServerException.mockReturnValue(Effect.void);
    analyticsMocks.getRequestHeader.mockReturnValue(userAgent);
    analyticsMocks.waitUntil.mockImplementation((task: Promise<unknown>) => {
      analyticsMocks.tasks = Arr.append(analyticsMocks.tasks, () => task);
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

      expect(analyticsMocks.waitUntil).not.toHaveBeenCalled();
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

        yield* settleScheduledTask();

        expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
          error,
          properties,
          userAgent
        );
      })
  );

  it.effect("captures without a hint when no request scope is active", () =>
    Effect.gen(function* () {
      analyticsMocks.getRequestHeader.mockImplementationOnce(() => {
        throw new Error("headers unavailable");
      });
      const error = new Error("preload failed");

      yield* scheduleCurrentServerExceptionCapture(error, {
        source: "settings",
      });

      yield* settleScheduledTask();

      expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
        error,
        { source: "settings" },
        undefined
      );
    })
  );

  it.effect("schedules an explicitly provided operational exception", () =>
    Effect.gen(function* () {
      analyticsMocks.getRequestHeader.mockReturnValueOnce(undefined);
      const error = new Error("weather failed");

      yield* scheduleServerExceptionCapture(error, {
        source: "weather-api",
      });

      yield* settleScheduledTask();
      expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
        error,
        {
          source: "weather-api",
        },
        undefined
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

      yield* settleScheduledTask();
    })
  );

  it.effect("contains request scheduling failures", () =>
    Effect.gen(function* () {
      analyticsMocks.waitUntil.mockImplementation(() => {
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
