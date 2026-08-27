import { it } from "@effect/vitest";
import {
  logError,
  logHttpRequest,
  timeOperation,
} from "@repo/utilities/logging/effect";
import { Effect, Logger } from "effect";
import { describe, expect } from "vitest";

type StructuredLogEntry = ReturnType<typeof Logger.formatStructured.log>;

function makeLogCollector(entries: StructuredLogEntry[]) {
  return Logger.make((entry) =>
    entries.push(Logger.formatStructured.log(entry))
  );
}

describe("Effect logging utilities", () => {
  it.effect("logs errors with structured annotations", () =>
    Effect.gen(function* () {
      const entries: StructuredLogEntry[] = [];
      const logger = makeLogCollector(entries);

      yield* logError(new Error("Boom"), { service: "test-service" }).pipe(
        Effect.provide(Logger.layer([logger]))
      );

      const [entry] = entries;

      expect(entry).toBeDefined();

      if (!entry) {
        return;
      }

      expect(entry.level).toBe("ERROR");
      expect(entry.message).toBe("Boom");
      expect(entry.annotations.service).toBe("test-service");
      expect(entry.annotations.type).toBe("error");
    })
  );

  it.effect("derives HTTP log levels from status codes", () =>
    Effect.gen(function* () {
      const entries: StructuredLogEntry[] = [];
      const logger = makeLogCollector(entries);

      yield* Effect.all([
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
      ]).pipe(Effect.provide(Logger.layer([logger])));

      expect(entries.map((entry) => entry.level)).toEqual([
        "INFO",
        "WARN",
        "ERROR",
      ]);
    })
  );

  it.effect("returns the timed operation result", () =>
    Effect.gen(function* () {
      const entries: StructuredLogEntry[] = [];
      const logger = makeLogCollector(entries);

      const result = yield* timeOperation(
        "test_operation",
        Effect.succeed("done"),
        {
          service: "test-service",
        }
      ).pipe(Effect.provide(Logger.layer([logger])));

      const entry = entries.find(
        (item) => item.message === "test_operation completed"
      );

      expect(result).toBe("done");
      expect(entry).toBeDefined();

      if (!entry) {
        return;
      }

      expect(entry.annotations.service).toBe("test-service");
      expect(entry.annotations.type).toBe("timer");
    })
  );

  it.effect("keeps context optional for simple callers", () =>
    Effect.gen(function* () {
      const entries: StructuredLogEntry[] = [];
      const logger = makeLogCollector(entries);

      yield* Effect.all([
        logError(new Error("Without context")),
        timeOperation("contextless_operation", Effect.succeed("ok")),
      ]).pipe(Effect.provide(Logger.layer([logger])));

      expect(entries.map((entry) => entry.level)).toEqual(["ERROR", "INFO"]);
    })
  );
});
