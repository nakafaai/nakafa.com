import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  isServerExceptionReportingEnabled,
  reportUncaughtRequestError,
} from "@repo/analytics/server-reporting";
import { Effect } from "effect";

const captureServerException = vi.fn(
  (
    _error: unknown,
    _properties: unknown,
    _userAgent?: string
  ): Effect.Effect<void, Error> => Effect.void
);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@repo/analytics/posthog/server");
  captureServerException.mockClear();
});

/** Replaces the Node-only provider that the reporting gate loads after it passes. */
function mockProvider() {
  vi.doMock("@repo/analytics/posthog/server", () => ({
    captureServerException,
  }));
}

describe("server exception reporting runtime", () => {
  it.each([undefined, "false", "unknown-phase"])(
    "enables deployed production reporting for TSS_PRERENDERING=%s",
    (prerendering) => {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("TSS_PRERENDERING", prerendering);

      expect(isServerExceptionReportingEnabled()).toBe(true);
    }
  );

  it.each([
    ["production", "true"],
    ["preview", "false"],
    ["development", "false"],
    [undefined, "false"],
  ])(
    "fails closed for VERCEL_ENV=%s and TSS_PRERENDERING=%s",
    (vercelEnvironment, prerendering) => {
      vi.stubEnv("VERCEL_ENV", vercelEnvironment);
      vi.stubEnv("TSS_PRERENDERING", prerendering);

      expect(isServerExceptionReportingEnabled()).toBe(false);
    }
  );
});

describe("uncaught request error reporting", () => {
  it.effect(
    "captures the error with its method and user agent in production",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("VERCEL_ENV", "production");
        vi.stubEnv("TSS_PRERENDERING", undefined);
        mockProvider();
        const error = new Error("render failed");
        const request = new Request("https://nakafa.com/curricula", {
          headers: { "user-agent": "reviewer-agent" },
          method: "POST",
        });

        yield* reportUncaughtRequestError(error, request);

        expect(captureServerException).toHaveBeenCalledWith(
          error,
          { method: "POST", source: "start-uncaught-request" },
          "reviewer-agent"
        );
      })
  );

  it.effect("captures without a user agent when the request has none", () =>
    Effect.gen(function* () {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("TSS_PRERENDERING", undefined);
      mockProvider();
      const error = new Error("render failed");

      yield* reportUncaughtRequestError(
        error,
        new Request("https://nakafa.com/")
      );

      expect(captureServerException).toHaveBeenCalledWith(
        error,
        { method: "GET", source: "start-uncaught-request" },
        undefined
      );
    })
  );

  it.effect("skips the provider outside production", () =>
    Effect.gen(function* () {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("TSS_PRERENDERING", undefined);
      mockProvider();

      yield* reportUncaughtRequestError(
        new Error("render failed"),
        new Request("https://nakafa.com/")
      );

      expect(captureServerException).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "ignores a failed capture so the error response still answers",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("VERCEL_ENV", "production");
        vi.stubEnv("TSS_PRERENDERING", undefined);
        mockProvider();
        captureServerException.mockReturnValueOnce(
          Effect.fail(new Error("provider unavailable"))
        );

        const answered = yield* reportUncaughtRequestError(
          new Error("render failed"),
          new Request("https://nakafa.com/")
        );

        expect(answered).toBeUndefined();
      })
  );
});
