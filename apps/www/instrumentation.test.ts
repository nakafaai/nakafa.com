// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";

const instrumentationMocks = vi.hoisted(() => ({
  captureServerException: vi.fn(),
  isAiSdkDevToolsTelemetryEnabled: vi.fn(),
  isServerExceptionReportingEnabled: vi.fn(),
  postHogModuleLoads: 0,
  registerAiSdkDevToolsTelemetry: vi.fn(),
}));

vi.mock("@repo/ai/config/devtools-runtime", () => ({
  isAiSdkDevToolsTelemetryEnabled:
    instrumentationMocks.isAiSdkDevToolsTelemetryEnabled,
}));

vi.mock("@repo/ai/config/devtools", () => ({
  registerAiSdkDevToolsTelemetry:
    instrumentationMocks.registerAiSdkDevToolsTelemetry,
}));

vi.mock("@repo/analytics/server-reporting", () => ({
  isServerExceptionReportingEnabled:
    instrumentationMocks.isServerExceptionReportingEnabled,
}));

vi.mock("@repo/analytics/posthog/server", () => {
  instrumentationMocks.postHogModuleLoads += 1;
  return {
    captureServerException: instrumentationMocks.captureServerException,
  };
});

const loadInstrumentation = Effect.fn("www.instrumentation.test.load")(() =>
  Effect.promise(() => import("@/instrumentation"))
);

const request = {
  headers: { cookie: "ph_cookie=encoded" },
  method: "GET",
  path: "/id",
};

const requestContext = {
  renderSource: "react-server-components" as const,
  revalidateReason: undefined,
  routePath: "/[locale]",
  routeType: "render" as const,
  routerKind: "App Router" as const,
};

describe("Next.js instrumentation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    instrumentationMocks.captureServerException.mockReturnValue(Effect.void);
    instrumentationMocks.isAiSdkDevToolsTelemetryEnabled.mockReturnValue(false);
    instrumentationMocks.isServerExceptionReportingEnabled.mockReturnValue(
      false
    );
  });

  it.effect("registers AI SDK telemetry only in the Node.js runtime", () =>
    Effect.gen(function* () {
      const { register } = yield* loadInstrumentation();

      vi.stubEnv("NEXT_RUNTIME", "edge");
      yield* Effect.promise(() => register());
      expect(
        instrumentationMocks.registerAiSdkDevToolsTelemetry
      ).not.toHaveBeenCalled();

      vi.stubEnv("NEXT_RUNTIME", "nodejs");
      yield* Effect.promise(() => register());
      expect(
        instrumentationMocks.registerAiSdkDevToolsTelemetry
      ).not.toHaveBeenCalled();

      instrumentationMocks.isAiSdkDevToolsTelemetryEnabled.mockReturnValue(
        true
      );
      yield* Effect.promise(() => register());
      expect(
        instrumentationMocks.registerAiSdkDevToolsTelemetry
      ).toHaveBeenCalledOnce();
    })
  );

  it.effect("propagates startup telemetry registration defects", () =>
    Effect.gen(function* () {
      const { register } = yield* loadInstrumentation();
      vi.stubEnv("NEXT_RUNTIME", "nodejs");
      instrumentationMocks.isAiSdkDevToolsTelemetryEnabled.mockReturnValue(
        true
      );
      instrumentationMocks.registerAiSdkDevToolsTelemetry.mockImplementationOnce(
        () => {
          throw new Error("telemetry registration failed");
        }
      );

      const failure = yield* Effect.tryPromise(() => register()).pipe(
        Effect.flip
      );

      expect(failure.cause).toBeInstanceOf(Error);
      expect(String(failure.cause)).toContain("telemetry registration failed");
    })
  );

  it.effect("does not load provider code outside production Node.js", () =>
    Effect.gen(function* () {
      const providerLoadsBefore = instrumentationMocks.postHogModuleLoads;
      const { onRequestError } = yield* loadInstrumentation();

      vi.stubEnv("NEXT_RUNTIME", "edge");
      yield* Effect.promise(() =>
        onRequestError(new Error("edge failure"), request, requestContext)
      );

      vi.stubEnv("NEXT_RUNTIME", "nodejs");
      yield* Effect.promise(() =>
        onRequestError(
          new Error("development failure"),
          request,
          requestContext
        )
      );

      expect(instrumentationMocks.postHogModuleLoads).toBe(providerLoadsBefore);
      expect(
        instrumentationMocks.captureServerException
      ).not.toHaveBeenCalled();
    })
  );

  it.effect.each(["stale", "on-demand"] as const)(
    "reports production %s revalidation errors",
    (revalidateReason) =>
      Effect.gen(function* () {
        const { onRequestError } = yield* loadInstrumentation();
        vi.stubEnv("NEXT_RUNTIME", "nodejs");
        instrumentationMocks.isServerExceptionReportingEnabled.mockReturnValue(
          true
        );
        const error = new Error(`${revalidateReason} render failure`);

        yield* Effect.promise(() =>
          onRequestError(error, request, {
            ...requestContext,
            revalidateReason,
          })
        );

        expect(
          instrumentationMocks.captureServerException
        ).toHaveBeenCalledWith(
          error,
          expect.objectContaining({ revalidate_reason: revalidateReason })
        );
      })
  );

  it.effect(
    "lazily reports production request errors with render context",
    () =>
      Effect.gen(function* () {
        const { onRequestError } = yield* loadInstrumentation();
        vi.stubEnv("NEXT_RUNTIME", "nodejs");
        instrumentationMocks.isServerExceptionReportingEnabled.mockReturnValue(
          true
        );
        const error = Object.assign(new Error("render failure"), {
          digest: "NEXT_DIGEST",
        });

        yield* Effect.promise(() =>
          onRequestError(error, request, requestContext)
        );

        expect(
          instrumentationMocks.captureServerException
        ).toHaveBeenCalledWith(error, {
          error_digest: "NEXT_DIGEST",
          method: "GET",
          render_source: "react-server-components",
          revalidate_reason: undefined,
          route_path: "/[locale]",
          route_type: "render",
          router_kind: "App Router",
          source: "next-on-request-error",
        });
      })
  );

  it.effect(
    "contains provider failures without replacing the application error",
    () =>
      Effect.gen(function* () {
        const { onRequestError } = yield* loadInstrumentation();
        vi.stubEnv("NEXT_RUNTIME", "nodejs");
        instrumentationMocks.isServerExceptionReportingEnabled.mockReturnValue(
          true
        );
        instrumentationMocks.captureServerException.mockReturnValue(
          Effect.fail({ cause: new Error("provider unavailable") })
        );

        const result = yield* Effect.promise(() =>
          onRequestError(new Error("render failure"), request, requestContext)
        );

        expect(result).toBeUndefined();
      })
  );
});
