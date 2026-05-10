import {
  logError,
  logHttpRequest,
  timeOperation,
} from "@repo/utilities/logging/effect";
import { Effect, HashMap, Logger, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("Effect logging utilities", () => {
  it("logs errors with structured annotations", async () => {
    const entries: Logger.Logger.Options<unknown>[] = [];
    const logger = Logger.make((entry) => entries.push(entry));

    await Effect.runPromise(
      logError(new Error("Boom"), { service: "test-service" }).pipe(
        Effect.provide(Logger.replace(Logger.defaultLogger, logger))
      )
    );

    const [entry] = entries;

    expect(entry).toBeDefined();

    if (!entry) {
      return;
    }

    expect(entry.logLevel.label).toBe("ERROR");
    expect(entry.message).toEqual(["Boom"]);
    expect(
      Option.getOrUndefined(HashMap.get(entry.annotations, "service"))
    ).toBe("test-service");
    expect(Option.getOrUndefined(HashMap.get(entry.annotations, "type"))).toBe(
      "error"
    );
  });

  it("derives HTTP log levels from status codes", async () => {
    const entries: Logger.Logger.Options<unknown>[] = [];
    const logger = Logger.make((entry) => entries.push(entry));

    await Effect.runPromise(
      Effect.all([
        logHttpRequest({
          method: "GET",
          url: "/ok",
          statusCode: 200,
          duration: 12,
        }),
        logHttpRequest({
          method: "GET",
          url: "/missing",
          statusCode: 404,
          duration: 13,
        }),
        logHttpRequest({
          method: "GET",
          url: "/broken",
          statusCode: 500,
          duration: 14,
        }),
      ]).pipe(Effect.provide(Logger.replace(Logger.defaultLogger, logger)))
    );

    expect(entries.map((entry) => entry.logLevel.label)).toEqual([
      "INFO",
      "WARN",
      "ERROR",
    ]);
  });

  it("returns the timed operation result", async () => {
    const entries: Logger.Logger.Options<unknown>[] = [];
    const logger = Logger.make((entry) => entries.push(entry));

    const result = await Effect.runPromise(
      timeOperation("test_operation", Effect.succeed("done"), {
        service: "test-service",
      }).pipe(Effect.provide(Logger.replace(Logger.defaultLogger, logger)))
    );

    const entry = entries.find((item) =>
      Array.isArray(item.message)
        ? item.message.includes("test_operation completed")
        : false
    );

    expect(result).toBe("done");
    expect(entry).toBeDefined();

    if (!entry) {
      return;
    }

    expect(
      Option.getOrUndefined(HashMap.get(entry.annotations, "service"))
    ).toBe("test-service");
    expect(Option.getOrUndefined(HashMap.get(entry.annotations, "type"))).toBe(
      "timer"
    );
  });

  it("keeps context optional for simple callers", async () => {
    const entries: Logger.Logger.Options<unknown>[] = [];
    const logger = Logger.make((entry) => entries.push(entry));

    await Effect.runPromise(
      Effect.all([
        logError(new Error("Without context")),
        timeOperation("contextless_operation", Effect.succeed("ok")),
      ]).pipe(Effect.provide(Logger.replace(Logger.defaultLogger, logger)))
    );

    expect(entries.map((entry) => entry.logLevel.label)).toEqual([
      "ERROR",
      "INFO",
    ]);
  });
});
