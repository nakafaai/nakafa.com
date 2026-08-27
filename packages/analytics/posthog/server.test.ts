import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";

const postHogMocks = vi.hoisted(() => ({
  captureExceptionImmediate: vi.fn(),
  constructor: vi.fn(),
  keys: vi.fn(() => ({
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    POSTHOG_PROXY_HOST: "https://t.nakafa.com",
  })),
}));

vi.mock("@repo/analytics/keys", () => ({
  keys: postHogMocks.keys,
}));

vi.mock("posthog-node", () => ({
  PostHog: class {
    captureExceptionImmediate = postHogMocks.captureExceptionImmediate;

    constructor(...args: unknown[]) {
      postHogMocks.constructor(...args);
    }
  },
}));

vi.mock("server-only", () => ({}));

describe("PostHog server reporting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    postHogMocks.captureExceptionImmediate.mockResolvedValue(undefined);
  });

  it.effect("has no environment or SDK side effects when imported", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => import("@repo/analytics/posthog/server"));

      expect(postHogMocks.keys).not.toHaveBeenCalled();
      expect(postHogMocks.constructor).not.toHaveBeenCalled();
    })
  );

  it.effect("does not initialize the SDK when reporting is disabled", () =>
    Effect.gen(function* () {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("NEXT_PHASE", "phase-production-server");
      const { captureServerException } = yield* Effect.promise(
        () => import("@repo/analytics/posthog/server")
      );

      yield* captureServerException(new Error("request failed"), {
        source: "disabled-test",
      });

      expect(postHogMocks.keys).not.toHaveBeenCalled();
      expect(postHogMocks.constructor).not.toHaveBeenCalled();
    })
  );

  it.effect("initializes once and sends enabled production exceptions", () =>
    Effect.gen(function* () {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("NEXT_PHASE", "phase-production-server");
      const { captureServerException } = yield* Effect.promise(
        () => import("@repo/analytics/posthog/server")
      );
      const error = new Error("request failed for user@example.com");
      const properties = { source: "request" };

      yield* Effect.all(
        [
          captureServerException(error, properties),
          captureServerException(new Error("second failure"), {
            source: "second-request",
          }),
          captureServerException(
            { message: "object secret" },
            { source: "non-error-request" }
          ),
        ],
        { concurrency: 1 }
      );

      expect(postHogMocks.keys).toHaveBeenCalledOnce();
      expect(postHogMocks.constructor).toHaveBeenCalledExactlyOnceWith(
        "phc_test",
        {
          disableGeoip: true,
          disableSurveys: true,
          enableExceptionAutocapture: false,
          flushAt: 1,
          flushInterval: 0,
          host: "https://t.nakafa.com",
          personProfiles: "never",
          preloadFeatureFlags: false,
          sendFeatureFlagEvent: false,
        }
      );
      expect(postHogMocks.captureExceptionImmediate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          message: "Operational exception",
          name: "OperationalError",
        }),
        undefined,
        properties
      );
      expect(postHogMocks.captureExceptionImmediate).toHaveBeenCalledTimes(3);
      expect(
        JSON.stringify(postHogMocks.captureExceptionImmediate.mock.calls)
      ).not.toContain("user@example.com");
      expect(
        JSON.stringify(postHogMocks.captureExceptionImmediate.mock.calls)
      ).not.toContain("object secret");
    })
  );

  it.effect("drops invalid runtime context before initializing the SDK", () =>
    Effect.gen(function* () {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("NEXT_PHASE", "phase-production-server");
      const { captureServerException } = yield* Effect.promise(
        () => import("@repo/analytics/posthog/server")
      );
      const invalidProperties = {
        source: "server-test",
        userId: "user-1",
      };

      yield* captureServerException(new Error("blocked"), invalidProperties);

      expect(postHogMocks.keys).not.toHaveBeenCalled();
      expect(postHogMocks.constructor).not.toHaveBeenCalled();
      expect(postHogMocks.captureExceptionImmediate).not.toHaveBeenCalled();
    })
  );

  it.effect("surfaces provider failures through the typed error channel", () =>
    Effect.gen(function* () {
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("NEXT_PHASE", "phase-production-server");
      postHogMocks.captureExceptionImmediate.mockRejectedValueOnce(
        new Error("provider unavailable")
      );
      const { captureServerException, ServerAnalyticsCaptureError } =
        yield* Effect.promise(() => import("@repo/analytics/posthog/server"));

      const failure = yield* captureServerException(
        new Error("request failed"),
        {
          source: "provider-failure-test",
        }
      ).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(ServerAnalyticsCaptureError);
    })
  );
});
