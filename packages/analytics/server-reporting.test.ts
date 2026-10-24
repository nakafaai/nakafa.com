import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  isServerExceptionReportingEnabled,
  reportUncaughtRequestError,
} from "@repo/analytics/server-reporting";
import { Data, Effect, Logger, MutableList } from "effect";

/** The provider failure that a capture may meet, so the test names its error type. */
class ProviderUnavailable extends Data.TaggedError("ProviderUnavailable")<{
  readonly reason: string;
}> {}

const captureServerException = vi.fn(
  (
    _error: unknown,
    _properties: unknown,
    _userAgent?: string
  ): Effect.Effect<void, ProviderUnavailable> => Effect.void
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
      vi.stubEnv("NAKAFA_DEPLOY_STAGE", "prod");
      vi.stubEnv("TSS_PRERENDERING", prerendering);

      expect(isServerExceptionReportingEnabled()).toBe(true);
    }
  );

  it.each([
    ["prod", "true"],
    ["staging", "false"],
    ["development", "false"],
    [undefined, "false"],
  ])(
    "fails closed for NAKAFA_DEPLOY_STAGE=%s and TSS_PRERENDERING=%s",
    (vercelEnvironment, prerendering) => {
      vi.stubEnv("NAKAFA_DEPLOY_STAGE", vercelEnvironment);
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
        vi.stubEnv("NAKAFA_DEPLOY_STAGE", "prod");
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
      vi.stubEnv("NAKAFA_DEPLOY_STAGE", "prod");
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

  it.effect(
    "logs the error outside production, where no provider reports it",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("NAKAFA_DEPLOY_STAGE", "staging");
        vi.stubEnv("TSS_PRERENDERING", undefined);
        mockProvider();
        const messages = MutableList.make<unknown>();
        const error = new Error("render failed");

        yield* reportUncaughtRequestError(
          error,
          new Request("https://nakafa.com/")
        ).pipe(
          Effect.provide(
            Logger.layer([
              Logger.make(({ message }) => {
                MutableList.append(messages, message);
              }),
            ])
          )
        );

        const logged = MutableList.toArray(messages);
        expect(logged).toHaveLength(1);
        expect(logged[0]).toStrictEqual(expect.arrayContaining([error]));
        expect(captureServerException).not.toHaveBeenCalled();
      })
  );

  it.effect("skips the provider outside production", () =>
    Effect.gen(function* () {
      vi.stubEnv("NAKAFA_DEPLOY_STAGE", "staging");
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
        vi.stubEnv("NAKAFA_DEPLOY_STAGE", "prod");
        vi.stubEnv("TSS_PRERENDERING", undefined);
        mockProvider();
        captureServerException.mockReturnValueOnce(
          Effect.fail(new ProviderUnavailable({ reason: "down" }))
        );

        const answered = yield* reportUncaughtRequestError(
          new Error("render failed"),
          new Request("https://nakafa.com/")
        );

        expect(answered).toBeUndefined();
      })
  );
});
